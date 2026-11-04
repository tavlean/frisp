import { describe, expect, it } from 'vitest';
import {
  effectiveRecipe,
  inheritedRecipe,
  jobRecipeHash,
} from '../../src/client/lazy-app/bulk/session';
import {
  applyRecipeChanges,
  resolveRecipeForSource,
} from '../../src/client/lazy-app/bulk/settings';
import type { ImageRecipe } from '../../src/client/lazy-app/recipe';
import { job, recipe, resized, session, SVG_OPTIONS } from './fixtures';

const quality = (value: number) =>
  recipe((r) => {
    if (r.output.kind === 'raster') {
      (r.output.encoder.options as { quality: number }).quality = value;
    }
  });

describe('bulk effective recipes', () => {
  it('gives a plain job the shared recipe', () => {
    const shared = quality(60);
    const current = session([job('a')], { sharedRecipe: shared });
    expect(effectiveRecipe(current, current.jobs[0])).toEqual(shared);
  });

  it('keeps SVG sources on the vector lane with the shared SVG options', () => {
    const current = session([job('logo', { fileName: 'logo.svg' })]);
    const effective = effectiveRecipe(current, current.jobs[0]);
    expect(effective.output).toEqual({ kind: 'svg', options: SVG_OPTIONS });
    expect(effective.processors).toEqual(current.sharedRecipe.processors);
  });

  it("uses a job's own recipe whole, ignoring later shared edits", () => {
    const own = quality(40);
    const current = session([job('a', { ownRecipe: own })], {
      sharedRecipe: quality(90),
    });
    expect(effectiveRecipe(current, current.jobs[0])).toBe(own);
    expect(inheritedRecipe(current, current.jobs[0])).toEqual(quality(90));
  });

  it('resolves percentage resize presets against each source', () => {
    const current = session(
      [job('small', { sourceWidth: 300, sourceHeight: 150 })],
      {
        sharedRecipe: resized(500, 250),
        resizeReference: { width: 1000, height: 500 },
      },
    );
    expect(
      effectiveRecipe(current, current.jobs[0]).processors.resize,
    ).toMatchObject({ enabled: true, width: 150, height: 75 });
  });

  it('applies custom resize sizes as given', () => {
    const custom = resized(800, 600);
    expect(
      resolveRecipeForSource(
        custom,
        { width: 1000, height: 500 },
        { width: 300, height: 150 },
      ),
    ).toBe(custom);
  });

  it('does not resolve an own recipe against the reference', () => {
    const own = resized(500, 250);
    const current = session(
      [job('a', { ownRecipe: own, sourceWidth: 300, sourceHeight: 150 })],
      { resizeReference: { width: 1000, height: 500 } },
    );
    expect(effectiveRecipe(current, current.jobs[0])).toBe(own);
  });
});

describe('bulk output hashes', () => {
  it('is stable regardless of object key insertion order', () => {
    const left = recipe();
    const reordered: ImageRecipe = {
      processors: {
        resize: left.processors.resize,
        quantize: left.processors.quantize,
        grain: left.processors.grain,
      },
      output: left.output,
      rotate: left.rotate,
    };
    expect(jobRecipeHash(session([job()], { sharedRecipe: left }), job())).toBe(
      jobRecipeHash(session([job()], { sharedRecipe: reordered }), job()),
    );
  });

  it('collapses disabled processor options', () => {
    const changed = recipe((r) => {
      r.processors.grain = { enabled: false, amount: 80, size: 60 };
      r.processors.quantize = { enabled: false, numColors: 8, dither: 0.25 };
      r.processors.resize = {
        ...r.processors.resize,
        enabled: false,
        width: 999,
        height: 777,
        method: 'mitchell',
      };
    });
    const sized = job('a', { sourceWidth: 800, sourceHeight: 600 });
    expect(
      jobRecipeHash(session([sized], { sharedRecipe: changed }), sized),
    ).toBe(jobRecipeHash(session([sized]), sized));
  });

  it('collapses an enabled identity resize for that source', () => {
    const sized = job('a', { sourceWidth: 800, sourceHeight: 600 });
    expect(
      jobRecipeHash(
        session([sized], { sharedRecipe: resized(800, 600) }),
        sized,
      ),
    ).toBe(jobRecipeHash(session([sized]), sized));
  });

  it('hashes a preset-resized job like its resolved recipe', () => {
    const sized = job('a', { sourceWidth: 300, sourceHeight: 150 });
    const current = session([sized], {
      sharedRecipe: resized(500, 250),
      resizeReference: { width: 1000, height: 500 },
    });
    const direct = session([sized], { sharedRecipe: resized(150, 75) });
    expect(jobRecipeHash(current, sized)).toBe(jobRecipeHash(direct, sized));
  });
});

describe('applyRecipeChanges', () => {
  it('carries only the changed parts onto another recipe', () => {
    const before = recipe();
    const after = quality(55);
    const target = resized(320, 200, quality(90));

    const next = applyRecipeChanges(target, before, after);

    expect(next.output).toEqual(after.output);
    expect(next.processors.resize).toEqual(target.processors.resize);
  });

  it('carries a processor change and keeps the target output', () => {
    const before = recipe();
    const after = resized(100, 100);
    const target = quality(30);

    const next = applyRecipeChanges(target, before, after);

    expect(next.output).toEqual(target.output);
    expect(next.processors.resize).toEqual(after.processors.resize);
    expect(next.processors.grain).toEqual(target.processors.grain);
  });

  it('returns the target unchanged when nothing changed', () => {
    const target = quality(30);
    expect(applyRecipeChanges(target, recipe(), recipe())).toEqual(target);
  });
});
