import { describe, expect, it, vi } from 'vitest';
import {
  defaultProcessorState,
  type EncoderState,
} from '../../src/client/lazy-app/feature-meta/shared';
import type { ImageRecipe } from '../../src/client/lazy-app/recipe';
import {
  createPipelineOps,
  replyTransfers,
  type CodecHost,
  type OptimizeRequest,
} from '../../src/worker/pipeline-op';
import { getDefaultOptions } from '../../src/lib/compress';
import { fakeFile } from './fixtures';

globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const frame = (width: number, height: number) =>
  new ImageData(new Uint8ClampedArray(width * height * 4), width, height);

// PNG and JPEG magic bytes, so sniffMimeType routes them like real files.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const png = (name = 'a.png') =>
  new File([new Uint8Array(PNG_MAGIC)], name, { type: 'image/png' });
const jpeg = () =>
  new File([new Uint8Array(JPEG_MAGIC)], 'a.jpg', { type: 'image/jpeg' });

function fakeHost(overrides: Partial<CodecHost> = {}) {
  const host: CodecHost = {
    steps: {
      rotate: vi.fn(async (image) => frame(image.height, image.width)),
      resize: vi.fn(async (_image, o) => frame(o.width, o.height)),
      quantize: vi.fn(async (image) => image),
      encode: vi.fn(async () => new Uint8Array(PNG_MAGIC).buffer),
    },
    nativeDecode: vi.fn(async () => frame(4, 2)),
    wasmDecode: {
      'image/avif': vi.fn(),
      'image/webp': vi.fn(),
      'image/jxl': vi.fn(),
      'image/qoi': vi.fn(),
    },
    transcodeJpeg: vi.fn(async () => new ArrayBuffer(3)),
    ...overrides,
  };
  return host;
}

function recipe(
  encoder: EncoderState = {
    type: 'webP',
    options: getDefaultOptions('webP'),
  } as EncoderState,
  rotate: ImageRecipe['rotate'] = 0,
): ImageRecipe {
  return {
    rotate,
    processors: structuredClone(defaultProcessorState),
    output: { kind: 'raster', encoder },
  };
}

function fileRequest(
  file: File,
  key: string,
  edit: Partial<OptimizeRequest> = {},
): OptimizeRequest {
  return {
    key,
    file,
    source: { kind: 'file', file },
    recipe: recipe(),
    preview: false,
    ...edit,
  };
}

describe('pipeline ops', () => {
  it('decodes a file source once per key and reuses it', async () => {
    const host = fakeHost();
    const ops = createPipelineOps(host);
    const file = png();
    await ops.optimize(fileRequest(file, 'src-1'));
    await ops.optimize(
      fileRequest(file, 'src-1', { recipe: recipe(undefined, 90) }),
    );
    await ops.optimize(
      fileRequest(file, 'src-1', { recipe: recipe(undefined, 90) }),
    );
    expect(host.nativeDecode).toHaveBeenCalledOnce();
    // The rotation is cached alongside the decoded frame.
    expect(host.steps.rotate).toHaveBeenCalledOnce();
    await ops.optimize(fileRequest(png('b.png'), 'src-2'));
    expect(host.nativeDecode).toHaveBeenCalledTimes(2);
  });

  it('asks for pixels it does not hold, then caches them', async () => {
    const host = fakeHost();
    const ops = createPipelineOps(host);
    const base = fileRequest(
      fakeFile('logo.svg', { type: 'image/svg+xml' }),
      'svg-1',
    );
    expect(await ops.optimize({ ...base, source: undefined })).toEqual({
      kind: 'needs-source',
    });
    const reply = await ops.optimize({
      ...base,
      source: { kind: 'pixels', image: frame(6, 3) },
    });
    expect(reply).toMatchObject({ kind: 'encoded', decodedWidth: 6 });
    expect(await ops.optimize({ ...base, source: undefined })).toMatchObject({
      kind: 'encoded',
    });
    expect(host.nativeDecode).not.toHaveBeenCalled();
  });

  it('reports the rotated size and decodes the preview only when asked', async () => {
    const host = fakeHost();
    const ops = createPipelineOps(host);
    const quiet = await ops.optimize(
      fileRequest(png(), 'k', { recipe: recipe(undefined, 90) }),
    );
    expect(quiet).toMatchObject({
      decodedWidth: 4,
      decodedHeight: 2,
      preparedWidth: 2,
      preparedHeight: 4,
    });
    expect(quiet.kind === 'encoded' && quiet.preview).toBeUndefined();
    const shown = await ops.optimize(
      fileRequest(png(), 'k', { preview: true }),
    );
    expect(shown.kind === 'encoded' && shown.preview?.width).toBe(4);
  });

  it('scores the decoded output against the processed frame and reuses it as the preview', async () => {
    const score = vi.fn(async () => 87.5);
    const host = fakeHost({ score });
    const ops = createPipelineOps(host);
    const resized = recipe();
    resized.processors.resize = {
      ...resized.processors.resize,
      enabled: true,
      width: 2,
      height: 1,
    };
    const reply = await ops.optimize(
      fileRequest(png(), 's', { recipe: resized, preview: true, score: true }),
    );
    if (reply.kind !== 'encoded') throw Error('expected an encode');
    expect(reply.score).toBe(87.5);
    // One decode of the source and one of the output: the preview IS the
    // scored output, not a second decode.
    expect(host.nativeDecode).toHaveBeenCalledTimes(2);
    const [ref, dist] = score.mock.calls[0] as unknown as [
      ImageData,
      ImageData,
    ];
    // The reference is the resized frame the encoder received.
    expect([ref.width, ref.height]).toEqual([2, 1]);
    expect(host.steps.encode).toHaveBeenCalledWith(
      ref,
      resized.output.kind === 'raster' && resized.output.encoder,
    );
    expect(dist).toBe(reply.preview);
  });

  it('leaves unscored requests without a score and refuses to score a transcode', async () => {
    const host = fakeHost({ score: vi.fn(async () => 1) });
    const ops = createPipelineOps(host);
    const plain = await ops.optimize(fileRequest(png(), 'p'));
    expect(plain).not.toHaveProperty('score');
    expect(host.score).not.toHaveBeenCalled();
    const jxl = {
      type: 'jxl',
      options: { ...getDefaultOptions('jxl'), jpegTranscode: true },
    } as EncoderState;
    await expect(
      ops.optimize(
        fileRequest(jpeg(), 'j', { recipe: recipe(jxl), score: true }),
      ),
    ).rejects.toThrow('not a JXL transcode');
    expect(host.transcodeJpeg).not.toHaveBeenCalled();
  });

  it('transcodes a JPEG and falls back to pixels when libjxl refuses', async () => {
    const jxl = {
      type: 'jxl',
      options: { ...getDefaultOptions('jxl'), jpegTranscode: true },
    } as EncoderState;
    const host = fakeHost();
    const ops = createPipelineOps(host);
    const file = jpeg();
    const ok = await ops.optimize(
      fileRequest(file, 'j', { recipe: recipe(jxl) }),
    );
    expect(ok).toMatchObject({ transcodeFellBack: false });
    expect(host.steps.encode).not.toHaveBeenCalled();

    vi.mocked(host.transcodeJpeg).mockResolvedValueOnce(null);
    const fell = await ops.optimize(
      fileRequest(file, 'j', { recipe: recipe(jxl) }),
    );
    expect(fell).toMatchObject({ transcodeFellBack: true });
    expect(host.steps.encode).toHaveBeenCalledOnce();
  });

  it('falls back to the WASM decoder and names a decode failure', async () => {
    const webpFile = new File(
      [new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')],
      'a.webp',
      { type: 'image/webp' },
    );
    const host = fakeHost({
      nativeDecode: vi.fn(async () => {
        throw Error('no native webp');
      }),
    });
    vi.mocked(host.wasmDecode['image/webp']).mockResolvedValue(frame(2, 2));
    const ops = createPipelineOps(host);
    await ops.optimize(fileRequest(webpFile, 'w'));
    expect(host.wasmDecode['image/webp']).toHaveBeenCalledOnce();
    await expect(ops.optimize(fileRequest(png(), 'p'))).rejects.toThrow(
      "Couldn't decode image",
    );
  });

  it('hands every reply buffer to the transfer list', async () => {
    const ops = createPipelineOps(fakeHost());
    const reply = await ops.optimize(
      fileRequest(png(), 'k', { preview: true }),
    );
    if (reply.kind !== 'encoded') throw Error('expected an encode');
    expect(replyTransfers(reply)).toEqual([
      reply.bytes,
      reply.preview!.data.buffer,
    ]);
    const prepared = await ops.prepare({
      source: { kind: 'file', file: png() },
      rotate: 0,
    });
    expect(replyTransfers(prepared)).toEqual([prepared.image.data.buffer]);
    expect(replyTransfers({ kind: 'needs-source' })).toEqual([]);
  });
});
