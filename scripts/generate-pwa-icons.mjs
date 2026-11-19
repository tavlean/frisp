/**
 * Renders the install-icon rasters: static/icon-192.png and
 * static/icon-512.png (the web-app-manifest icons) and
 * static/apple-touch-icon.png (the iOS home-screen icon).
 *
 * Kept as a script rather than hand-made binaries for the same reason as
 * generate-social-card.mjs: the icons are reproducible from source, with the
 * logomark coming from the one canonical file and the ground from the dark
 * half of Intro's --i-* token contract. Re-run after any brand change
 * (`pnpm run pwa-icons`).
 *
 * One manifest set serves both `purpose: any` and `purpose: maskable`. The
 * mark's bounding box is sized so its corners stay inside the maskable safe
 * zone (a centred circle spanning 80% of the icon), which doubles as
 * comfortable padding when the icon is shown unmasked. The ground is
 * full-bleed on purpose: maskable icons must have no transparent margin, or
 * Android pads them onto a white plate. The apple-touch icon has no safe-zone
 * rule (iOS applies its own squircle crop, trimming only the extreme
 * corners), so its mark sits a step larger.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = new URL('../', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, repoRoot)));

// The dark half of Intro.svelte's --i-* token contract, duplicated for the
// same reason the social-card script duplicates it: this runs in Node with no
// CSS pipeline, and a drifted icon is a visible bug rather than a silent one.
const PAGE = '#111113';
const MARK = '#f5f5f7';

// Mark height as a fraction of the icon. At 0.56, with the mark's 1650:1800
// aspect, the bounding-box corner sits at radius ~0.38 from centre, inside
// the 0.40 maskable safe zone with a little slack. 180 is the one
// apple-touch size modern iOS uses; every device scales it down from there.
const ICONS = [
  { file: 'icon-192.png', size: 192, markHeight: 0.56 },
  { file: 'icon-512.png', size: 512, markHeight: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, markHeight: 0.62 },
];

const logomark = read('src/lib/brand/logomark.svg').toString('utf8');

const browser = await chromium.launch();
try {
  for (const { file, size, markHeight } of ICONS) {
    const html = `<!doctype html>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; }
  html, body { width: ${size}px; height: ${size}px; }
  body {
    background: ${PAGE};
    display: grid;
    place-items: center;
  }
  .mark {
    height: ${Math.round(size * markHeight)}px;
    width: ${Math.round(size * markHeight * (1650 / 1800))}px;
    color: ${MARK};
  }
  .mark svg { width: 100%; height: 100%; display: block; }
</style>
<span class="mark">${logomark}</span>`;

    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'load' });
    const shot = await page.screenshot({ type: 'png' });
    const out = `static/${file}`;
    writeFileSync(fileURLToPath(new URL(out, repoRoot)), shot);
    await page.close();
    console.log(`Wrote ${out} (${size}x${size}, ${shot.length} bytes)`);
  }
} finally {
  await browser.close();
}
