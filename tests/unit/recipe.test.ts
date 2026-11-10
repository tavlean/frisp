import { describe, expect, it } from 'vitest';
import {
  defaultProcessorState,
  encoderMap,
  type EncoderState,
  type PreprocessorState,
  type ProcessorState,
} from '../../src/client/lazy-app/feature-meta/shared';
import {
  normalizedRecipe,
  recipeChangesPixels,
  recipeSignature,
  type ImageRecipe,
  type Rotation,
} from '../../src/client/lazy-app/recipe';
import { getDefaultOptions, type SideFormat } from '../../src/lib/compress';
import { encodeSignature } from '../../src/lib/editor/encode-signature';
import {
  applyRecipeToSide,
  recipeFromSide,
} from '../../src/lib/editor/side-recipe';
import type { SideState } from '../../src/lib/editor/editor-session.svelte';
import { DEFAULT_SVG_OPTIONS } from '../../src/lib/svg/optimize-options';

const SOURCE = { width: 1024, height: 683 };

function processors(
  edit: (state: ProcessorState) => void = () => {},
): ProcessorState {
  const state = structuredClone(defaultProcessorState);
  edit(state);
  return state;
}

function raster(
  edit: (recipe: ImageRecipe) => void = () => {},
  encoder: EncoderState = {
    type: 'webP',
    options: structuredClone(encoderMap.webP.meta.defaultOptions),
  },
): ImageRecipe {
  const recipe: ImageRecipe = {
    rotate: 0,
    processors: processors(),
    output: { kind: 'raster', encoder },
  };
  edit(recipe);
  return recipe;
}

function jxl(jpegTranscode: boolean): ImageRecipe {
  return raster(() => {}, {
    type: 'jxl',
    options: { ...getDefaultOptions('jxl'), jpegTranscode },
  } as EncoderState);
}

function svg(edit: (recipe: ImageRecipe) => void = () => {}): ImageRecipe {
  const recipe: ImageRecipe = {
    rotate: 0,
    processors: processors(),
    output: { kind: 'svg', options: { ...DEFAULT_SVG_OPTIONS } },
  };
  edit(recipe);
  return recipe;
}

const sig = (recipe: ImageRecipe, source = SOURCE) =>
  recipeSignature(recipe, source);

describe('recipeSignature', () => {
  it('folds grain enabled at zero, but not real grain', () => {
    const atZero = raster((r) => {
      r.processors.grain.enabled = true;
      r.processors.grain.amount = 0;
    });
    const real = raster((r) => {
      r.processors.grain.enabled = true;
      r.processors.grain.amount = 30;
    });
    expect(sig(atZero)).toBe(sig(raster()));
    expect(sig(real)).not.toBe(sig(raster()));
  });

  it('ignores quantize options while quantize is disabled', () => {
    const disabled = raster((r) => {
      r.processors.quantize.maxNumColors = 8;
      r.processors.quantize.dither = 0.25;
    });
    const enabled = raster((r) => {
      r.processors.quantize.enabled = true;
    });
    expect(sig(disabled)).toBe(sig(raster()));
    expect(sig(enabled)).not.toBe(sig(raster()));
  });

  it('folds a disabled resize and a resize to the source size', () => {
    const disabled = raster((r) => {
      r.processors.resize.width = 320;
      r.processors.resize.height = 200;
    });
    const identity = raster((r) => {
      Object.assign(r.processors.resize, { enabled: true, ...SOURCE });
    });
    const real = raster((r) => {
      Object.assign(r.processors.resize, {
        enabled: true,
        width: 512,
        height: 342,
      });
    });
    expect(sig(disabled)).toBe(sig(raster()));
    expect(sig(identity)).toBe(sig(raster()));
    expect(sig(real)).not.toBe(sig(raster()));
  });

  it('counts an enabled resize as real when the source size is unknown', () => {
    const identity = raster((r) => {
      Object.assign(r.processors.resize, { enabled: true, ...SOURCE });
    });
    expect(recipeSignature(identity)).not.toBe(recipeSignature(raster()));
    expect(recipeSignature(identity, { width: 0, height: 0 })).not.toBe(
      recipeSignature(raster(), { width: 0, height: 0 }),
    );
  });

  it('compares the resize against the rotated source', () => {
    const turned = (width: number, height: number) =>
      raster((r) => {
        r.rotate = 90;
        Object.assign(r.processors.resize, { enabled: true, width, height });
      });
    const unresized = raster((r) => {
      r.rotate = 90;
    });
    // 1024x683 turned a quarter is 683x1024: resizing to that is a no-op...
    expect(sig(turned(683, 1024))).toBe(sig(unresized));
    // ...while the unrotated size is now a real (distorting) resize.
    expect(sig(turned(1024, 683))).not.toBe(sig(unresized));
    // A half turn keeps the orientation.
    const half = raster((r) => {
      r.rotate = 180;
      Object.assign(r.processors.resize, { enabled: true, ...SOURCE });
    });
    expect(sig(half)).toBe(sig(raster((r) => (r.rotate = 180))));
  });

  it('separates rotations for raster output', () => {
    const rotations: Rotation[] = [0, 90, 180, 270];
    const sigs = rotations.map((rotate) =>
      sig(raster((r) => (r.rotate = rotate))),
    );
    expect(new Set(sigs).size).toBe(4);
  });

  it('drops rotation and processors for SVG output', () => {
    const busy = svg((r) => {
      r.rotate = 90;
      r.processors.grain.enabled = true;
      r.processors.grain.amount = 50;
      r.processors.quantize.enabled = true;
      Object.assign(r.processors.resize, {
        enabled: true,
        width: 10,
        height: 10,
      });
    });
    expect(sig(busy)).toBe(sig(svg()));
    expect(normalizedRecipe(busy)).toEqual({ output: svg().output });
    const precise = svg((r) => {
      r.output = {
        kind: 'svg',
        options: { ...DEFAULT_SVG_OPTIONS, precision: 1 },
      };
    });
    expect(sig(precise)).not.toBe(sig(svg()));
  });

  it('keeps the JXL transcode flag in the signature', () => {
    expect(sig(jxl(true))).not.toBe(sig(jxl(false)));
  });

  it('is independent of key order', () => {
    const recipe = raster();
    const reordered = raster((r) => {
      r.output = {
        kind: 'raster',
        encoder: Object.fromEntries(
          Object.entries(
            (recipe.output as { encoder: EncoderState }).encoder,
          ).reverse(),
        ) as EncoderState,
      };
    });
    expect(sig(reordered)).toBe(sig(recipe));
  });
});

describe('recipeChangesPixels', () => {
  const cases: [string, ImageRecipe, boolean][] = [
    ['plain re-encode', raster(), false],
    ['transcode flag alone', jxl(true), false],
    ['rotation', raster((r) => (r.rotate = 270)), true],
    [
      'grain at zero',
      raster((r) => {
        r.processors.grain.enabled = true;
        r.processors.grain.amount = 0;
      }),
      false,
    ],
    [
      'real grain',
      raster((r) => {
        r.processors.grain.enabled = true;
        r.processors.grain.amount = 10;
      }),
      true,
    ],
    ['palette', raster((r) => (r.processors.quantize.enabled = true)), true],
    [
      'identity resize',
      raster((r) =>
        Object.assign(r.processors.resize, { enabled: true, ...SOURCE }),
      ),
      false,
    ],
    [
      'real resize',
      raster((r) =>
        Object.assign(r.processors.resize, {
          enabled: true,
          width: 100,
          height: 100,
        }),
      ),
      true,
    ],
    [
      'SVG with everything on',
      svg((r) => {
        r.rotate = 90;
        r.processors.quantize.enabled = true;
      }),
      false,
    ],
  ];

  for (const [name, recipe, expected] of cases) {
    it(`${name}: ${expected}`, () => {
      expect(recipeChangesPixels(recipe, SOURCE)).toBe(expected);
    });
  }

  it('counts an enabled resize when the source size is unknown', () => {
    const identity = raster((r) =>
      Object.assign(r.processors.resize, { enabled: true, ...SOURCE }),
    );
    expect(recipeChangesPixels(identity)).toBe(true);
  });
});

describe('editor parity', () => {
  type FormatCase = [SideFormat, Record<string, unknown>];
  const formats: FormatCase[] = [
    ['identity', {}],
    ['webP', getDefaultOptions('webP')],
    ['avif', getDefaultOptions('avif')],
    ['jpegli', getDefaultOptions('jpegli')],
    ['oxiPNG', getDefaultOptions('oxiPNG')],
    ['jxl', { ...getDefaultOptions('jxl'), jpegTranscode: false }],
    ['jxl', { ...getDefaultOptions('jxl'), jpegTranscode: true }],
    ['svg', getDefaultOptions('svg')],
  ];
  const grains = ['off', 'zero', 'real'] as const;
  const quantizes = [false, true];
  const resizes = ['off', 'identity', 'real'] as const;
  const rotations: Rotation[] = [0, 90];

  function sideFor(
    [format, options]: FormatCase,
    grain: (typeof grains)[number],
    quantize: boolean,
    resize: (typeof resizes)[number],
    rotate: Rotation,
  ): SideState {
    const turned = rotate % 180 !== 0;
    const width = turned ? SOURCE.height : SOURCE.width;
    const height = turned ? SOURCE.width : SOURCE.height;
    return {
      format,
      optionsByFormat: { [format]: structuredClone(options) },
      processorState: processors((state) => {
        state.grain.enabled = grain !== 'off';
        state.grain.amount = grain === 'real' ? 25 : 0;
        state.quantize.enabled = quantize;
        if (resize !== 'off') {
          state.resize.enabled = true;
          state.resize.width = resize === 'identity' ? width : 300;
          state.resize.height = resize === 'identity' ? height : 200;
        }
      }),
    };
  }

  const matrix = formats.flatMap((format) =>
    grains.flatMap((grain) =>
      quantizes.flatMap((quantize) =>
        resizes.flatMap((resize) =>
          rotations.map((rotate) => ({
            format,
            grain,
            quantize,
            resize,
            rotate,
          })),
        ),
      ),
    ),
  );

  it('encodeSignature equals recipeSignature(recipeFromSide(...))', () => {
    for (const c of matrix) {
      const side = sideFor(c.format, c.grain, c.quantize, c.resize, c.rotate);
      const pre: PreprocessorState = { rotate: { rotate: c.rotate } };
      // The editor passes the PREPROCESSED (rotated) dims it reads off its
      // results; recipeSignature takes the unrotated source.
      const turned = c.rotate % 180 !== 0;
      const editorSig = encodeSignature(
        pre,
        side.format,
        side.optionsByFormat[side.format],
        side.processorState,
        turned ? SOURCE.height : SOURCE.width,
        turned ? SOURCE.width : SOURCE.height,
      );
      expect(editorSig, JSON.stringify(c)).toBe(
        recipeSignature(recipeFromSide(side, pre), SOURCE),
      );

      // And the projection folds exactly the no-op steps: the same side with
      // every inert step switched off keys identically. For SVG that is
      // every raster step and the rotation too.
      const isSvg = c.format[0] === 'svg';
      const canonicalRotate: Rotation = isSvg ? 0 : c.rotate;
      const canonical = sideFor(
        c.format,
        !isSvg && c.grain === 'real' ? 'real' : 'off',
        !isSvg && c.quantize,
        !isSvg && c.resize === 'real' ? 'real' : 'off',
        canonicalRotate,
      );
      expect(
        recipeSignature(
          recipeFromSide(canonical, { rotate: { rotate: canonicalRotate } }),
          SOURCE,
        ),
        JSON.stringify(c),
      ).toBe(editorSig);
    }
  });

  it('keys every output-affecting difference apart', () => {
    const sigs = new Set<string>();
    let expected = 0;
    for (const c of matrix) {
      const inert =
        c.grain === 'zero' ||
        c.resize === 'identity' ||
        (c.format[0] === 'svg' &&
          (c.grain !== 'off' ||
            c.quantize ||
            c.resize !== 'off' ||
            c.rotate !== 0));
      const side = sideFor(c.format, c.grain, c.quantize, c.resize, c.rotate);
      sigs.add(
        recipeSignature(
          recipeFromSide(side, { rotate: { rotate: c.rotate } }),
          SOURCE,
        ),
      );
      if (!inert) expected++;
    }
    expect(sigs.size).toBe(expected);
  });

  it('round-trips applyRecipeToSide through recipeFromSide', () => {
    for (const c of matrix) {
      const source = sideFor(c.format, c.grain, c.quantize, c.resize, c.rotate);
      const recipe = structuredClone(
        recipeFromSide(source, { rotate: { rotate: c.rotate } }),
      );
      const target = sideFor(formats[1], 'off', false, 'off', 0);
      const pre = applyRecipeToSide(recipe, target);
      expect(pre).toEqual({ rotate: { rotate: c.rotate } });
      expect(recipeFromSide(target, pre)).toEqual(recipe);
      // The side owns copies, not the recipe's objects.
      expect(target.processorState).not.toBe(recipe.processors);
    }
  });
});
