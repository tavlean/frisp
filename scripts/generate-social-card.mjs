/**
 * Renders static/social-card.png, the og:image / twitter:image.
 *
 * Kept as a script rather than a hand-made binary so the card is reproducible
 * from source: the logomark comes from the one canonical file, the palette from
 * the dark half of the same --i-* token contract Intro.svelte declares, the format
 * list from the same array the landing renders, and the wordmark from the shipped
 * Satoshi face. Re-run after any brand change (`pnpm run social-card`).
 *
 * It borrows the landing's LANGUAGE (dark viewfinder, dashed frame, Satoshi at
 * weight 900, quiet uppercase format row) but not its LAYOUT. A web page can hang
 * chrome off one corner because the viewport is understood to continue; a card is
 * a fixed graphic, where an off-centre lockup just reads as unbalanced. So
 * everything here sits on one centre axis.
 *
 * 1200x630 is the size Open Graph consumers crop from. Cards are often rendered
 * a fifth of that size in a chat sidebar, so the headline carries the message and
 * nothing load-bearing sits below 20px. Check any change at 300px and 180px wide.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = new URL('../', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, repoRoot)));

const WIDTH = 1200;
const HEIGHT = 630;

// The dark half of Intro.svelte's --i-* token contract. Duplicated deliberately:
// this runs in Node with no CSS pipeline, and a drifted card is a visible bug
// rather than a silent one.
const PAGE = '#111113';
const TEXT_1 = '#f5f5f7';
const TEXT_2 = 'rgba(245, 245, 247, 0.74)';
const TEXT_3 = 'rgba(245, 245, 247, 0.66)';
const ACCENT = '#ff8a5e';
// Same hue, dialled back so the frame reads as chrome and the headline keeps the
// one full-strength accent moment.
const ACCENT_DIM = 'rgba(255, 138, 94, 0.78)';

// Frame geometry follows the landing's 24px corner radius. The dash rhythm does
// NOT: the landing's "7 9" is right at viewport scale but collapses into a solid
// hairline once a card is scaled to a thumbnail. These are longer, heavier dashes
// with a gap wide enough to stay legible as dashes when the card is small.
const INSET = 30;
const RADIUS = 24;
const DASH = '13 15';
const DASH_WIDTH = 3.5;

// The same list, in the same order, that the landing shows. SVG belongs second:
// the vector lane is a headline capability, not a footnote.
const FORMATS = ['WebP', 'SVG', 'AVIF', 'JPEG XL', 'PNG', 'JPEG'];

const logomark = read('src/lib/brand/logomark.svg').toString('utf8');
const satoshi = read('static/fonts/Satoshi-Variable.woff2').toString('base64');

const html = `<!doctype html>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Satoshi';
    src: url(data:font/woff2;base64,${satoshi}) format('woff2');
    font-weight: 300 900;
    font-display: block;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    background: ${PAGE};
    font-family: 'Satoshi', system-ui, sans-serif;
    color: ${TEXT_1};
    -webkit-font-smoothing: antialiased;
    /* One centred column: brand, message, formats. Three bands on one axis. */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: ${INSET + 46}px 96px ${INSET + 42}px;
    position: relative;
    overflow: hidden;
  }

  /* The surface stays FLAT on purpose. An earlier version had a soft accent glow
     behind the headline, echoing the landing's .frame-glow, but it was barely
     perceptible and it tripled the PNG: 203 kB with it, 58 kB without, because a
     wide gradient defeats PNG's row filters. Shipping a needlessly heavy image
     from an image-optimizer would be a poor advertisement, and the flat surface
     reads cleaner anyway. */

  /* An SVG is a replaced element, so "inset: 0" alone would leave it at its
     intrinsic 300x150 and clip the rect (the same trap Intro.svelte documents).
     It needs an explicit box. */
  .frame {
    position: absolute;
    top: 0;
    left: 0;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
  }

  /* Brand lockup, centred. Big enough to READ the name, small enough that the
     headline stays the subject. */
  .brand { display: flex; align-items: center; gap: 17px; }
  /* Mark aspect is 1650x1800, so height drives width. */
  .mark { width: 46px; height: 50px; color: ${TEXT_1}; display: block; }
  .mark svg { width: 100%; height: 100%; display: block; }
  .brand-name {
    font-size: 44px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${TEXT_1};
  }

  .message { text-align: center; margin-bottom: 14px; }
  /* The landing's .headline treatment: weight 900, tight tracking and leading. */
  .headline {
    font-size: 102px;
    font-weight: 900;
    letter-spacing: -0.038em;
    line-height: 1.02;
  }
  .headline .accent { color: ${ACCENT}; }
  .subline {
    margin-top: 26px;
    font-size: 31px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${TEXT_2};
  }
  /* The landing's .hud-line treatment, scaled up for a card. */
  .formats {
    font-size: 20px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: ${TEXT_3};
    display: flex;
    gap: 24px;
  }
</style>

<svg class="frame" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect
    x="${INSET}" y="${INSET}"
    width="${WIDTH - INSET * 2}" height="${HEIGHT - INSET * 2}"
    rx="${RADIUS}"
    fill="none"
    stroke="${ACCENT_DIM}"
    stroke-width="${DASH_WIDTH}"
    stroke-dasharray="${DASH}"
  />
</svg>

<div class="brand">
  <span class="mark">${logomark}</span>
  <span class="brand-name">Frisp</span>
</div>

<div class="message">
  <h1 class="headline">Smaller images,<br /><span class="accent">same quality.</span></h1>
  <p class="subline">In your browser. No uploads, works offline.</p>
</div>

<p class="formats">${FORMATS.map((f) => `<span>${f}</span>`).join('')}</p>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  writeFileSync(fileURLToPath(new URL('static/social-card.png', repoRoot)), png);
  console.log(`Wrote static/social-card.png (${WIDTH}x${HEIGHT}, ${png.length} bytes)`);
} finally {
  await browser.close();
}
