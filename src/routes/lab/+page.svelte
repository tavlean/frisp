<script lang="ts">
  import { dev } from '$app/environment';
  import { resolve } from '$app/paths';

  const experiments = [
    {
      name: 'porcelain',
      href: resolve('/lab/porcelain'),
      vignette: 'porcelain',
      tag: null,
      tagline:
        'Light, airy, squircle — the current layout in a porcelain skin.',
      caption:
        'Floating toolbar · Edit/Compress tabs · Variations-style compare',
    },
    {
      name: 'darkroom',
      href: resolve('/lab/darkroom'),
      vignette: 'darkroom',
      tag: null,
      tagline:
        'Dense pro-tool — icon rail, eye-enabled sections, session filmstrip.',
      caption: 'Rail + flyouts · Inspector chips · Filmstrip → bulk',
    },
    {
      name: 'hybrid',
      href: resolve('/lab/hybrid'),
      vignette: 'hybrid',
      tag: 'recommended',
      tagline:
        "Darkroom's architecture in porcelain's skin — one bottom bar, no stray panels.",
      caption: 'Rail + flyouts · Eye sections · Zoom docked in the strip',
    },
    {
      name: 'intro page',
      href: resolve('/lab/intro'),
      vignette: 'intro',
      tag: null,
      tagline:
        'Four takes on the landing screen — minimal full-viewport drop area, tiny header + footer.',
      caption: 'billboard · frame · split · ledger — all light + dark',
    },
  ] as const;
</script>

{#if dev}
  <main class="lab-index">
    <header class="head">
      <p class="eyebrow">frisp</p>
      <h1 class="title">Lab</h1>
      <p class="lede">
        Dev-only experiments — each is the real editor wearing a different skin.
        Pick by looking.
      </p>
    </header>

    <ul class="grid">
      {#each experiments as exp (exp.name)}
        <li>
          <a class="card" href={exp.href}>
            <!-- Per-experiment vignettes are INTENTIONALLY fixed light/dark
                 (they preview each skin's own palette), so they do NOT follow
                 the page's system color-scheme. -->
            <div class="vignette vignette--{exp.vignette}">
              {#if exp.vignette === 'porcelain'}
                <div class="p-toolbar"></div>
                <div class="p-panel p-panel--left"></div>
                <div class="p-panel p-panel--right"></div>
              {:else if exp.vignette === 'darkroom'}
                <div class="d-rail">
                  <span></span><span></span><span></span><span></span>
                </div>
                <div class="d-inspector"></div>
                <div class="d-strip">
                  <span></span><span></span><span></span>
                </div>
              {:else if exp.vignette === 'intro'}
                <div class="i-header"></div>
                <div class="i-headline"></div>
                <div class="i-headline i-headline--short"></div>
                <div class="i-drop"></div>
                <div class="i-footer"></div>
              {:else}
                <div class="h-rail">
                  <span></span><span></span><span></span>
                </div>
                <div class="h-inspector"></div>
                <div class="h-strip">
                  <span></span><span></span><span></span>
                </div>
              {/if}
              {#if exp.tag}
                <span class="tag">{exp.tag}</span>
              {/if}
            </div>
            <div class="meta">
              <p class="name">{exp.name}</p>
              <p class="tagline">{exp.tagline}</p>
              <p class="caption">{exp.caption}</p>
            </div>
          </a>
        </li>
      {/each}
    </ul>

    <footer class="foot">
      <p class="notes">Decision notes: docs/lab-editor-restyle.md</p>
      <a class="back" href={resolve('/')}>← back to the editor</a>
    </footer>
  </main>
{:else}
  <p>Not found</p>
{/if}

<style>
  /* System-driven dual mode for the page chrome; no manual toggle here. All
     page tokens resolve via light-dark() so this route follows the OS. */
  .lab-index {
    color-scheme: light dark;

    --bg: light-dark(#faf9f8, #0e0e0e);
    --surface: light-dark(#ffffff, #171717);
    --border: light-dark(#e8e6e3, #262626);
    --text-1: light-dark(#1a1a1a, #f2f2f2);
    --text-2: light-dark(#5a5854, #a3a3a3);
    --text-3: light-dark(#8a8884, #6f6f6f);
    --ring: light-dark(#3b6df2, #6f97ff);
    --shadow: light-dark(
      0 1px 2px rgba(0, 0, 0, 0.06),
      0 1px 2px rgba(0, 0, 0, 0.4)
    );
    --shadow-lift: light-dark(
      0 10px 28px rgba(0, 0, 0, 0.12),
      0 12px 30px rgba(0, 0, 0, 0.55)
    );

    box-sizing: border-box;
    min-height: 100vh;
    /* The background must cover the full viewport, not just the centred
       column — the column is constrained via responsive side padding. */
    padding: 56px max(24px, calc((100vw - 980px) / 2)) 40px;
    background: var(--bg);
    color: var(--text-1);
  }

  .lab-index :global(*) {
    box-sizing: border-box;
  }

  .head {
    margin-bottom: 32px;
  }

  .eyebrow {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    color: var(--text-3);
  }

  .title {
    margin: 0 0 10px;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--text-1);
  }

  .lede {
    margin: 0;
    max-width: 52ch;
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-2);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .card {
    display: block;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
  }
  /* True squircles where supported (Chromium); the radius is re-tuned upward
     because superellipse corners read tighter than round ones at the same
     value. Other engines keep the plain 16px rounding above. */
  @supports (corner-shape: squircle) {
    .card {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }
  .card {
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lift);
    border-color: light-dark(#dcd9d5, #333333);
  }

  .card:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: box-shadow 160ms ease;
    }
    .card:hover {
      transform: none;
    }
  }

  /* --- Vignette frame (the CSS mockup area) --- */
  .vignette {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
  }

  .tag {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #ffffff;
    background: #2f6d4f;
  }

  /* --- porcelain vignette: ALWAYS light (previews its own warm skin) --- */
  .vignette--porcelain {
    background: #f2f1ef;
  }
  .p-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 42%;
    height: 12px;
    border-radius: 999px;
    background: #ffffff;
    box-shadow: 0 3px 10px rgba(70, 60, 50, 0.12);
  }
  .p-panel {
    position: absolute;
    top: 38px;
    bottom: 16px;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 6px 18px rgba(70, 60, 50, 0.1);
  }
  .p-panel--left {
    left: 16px;
    width: 30%;
  }
  .p-panel--right {
    right: 16px;
    width: 40%;
  }

  /* --- intro vignette: light warm landing mock (headline + drop + chrome) --- */
  .vignette--intro {
    background: #f4f3f1;
  }
  .i-header {
    position: absolute;
    top: 12px;
    left: 16px;
    right: 16px;
    height: 6px;
    border-radius: 999px;
    background: rgba(30, 25, 20, 0.14);
  }
  .i-headline {
    position: absolute;
    top: 34%;
    left: 22%;
    right: 22%;
    height: 12px;
    border-radius: 999px;
    background: rgba(30, 25, 20, 0.5);
  }
  .i-headline--short {
    top: 46%;
    left: 32%;
    right: 32%;
    background: #e4602f;
  }
  .i-drop {
    position: absolute;
    top: 60%;
    bottom: 20%;
    left: 30%;
    right: 30%;
    border: 1.5px dashed rgba(30, 25, 20, 0.35);
    border-radius: 10px;
    background: #ffffff;
  }
  .i-footer {
    position: absolute;
    bottom: 10px;
    left: 30%;
    right: 30%;
    height: 5px;
    border-radius: 999px;
    background: rgba(30, 25, 20, 0.12);
  }

  /* --- darkroom vignette: ALWAYS dark (previews its own near-black skin) --- */
  .vignette--darkroom {
    background: #161616;
  }
  .d-rail {
    position: absolute;
    top: 14px;
    bottom: 44px;
    left: 12px;
    width: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding-top: 4px;
  }
  .d-rail span {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: #2c2c2c;
  }
  .d-inspector {
    position: absolute;
    top: 14px;
    bottom: 44px;
    right: 14px;
    width: 38%;
    border-radius: 8px;
    background: #202020;
    border: 1px solid #2c2c2c;
  }
  .d-strip {
    position: absolute;
    left: 44px;
    right: 14px;
    bottom: 12px;
    height: 22px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .d-strip span {
    width: 30px;
    height: 20px;
    border-radius: 4px;
  }
  .d-strip span:nth-child(1) {
    background: #6b5a48;
  }
  .d-strip span:nth-child(2) {
    background: #43566b;
  }
  .d-strip span:nth-child(3) {
    background: #4a5a48;
  }

  /* --- hybrid vignette: ALWAYS light warm (darkroom shapes, porcelain skin) --- */
  .vignette--hybrid {
    background: #f4f2ef;
  }
  .h-rail {
    position: absolute;
    top: 14px;
    bottom: 44px;
    left: 12px;
    width: 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding-top: 4px;
  }
  .h-rail span {
    width: 14px;
    height: 14px;
    border-radius: 5px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(70, 60, 50, 0.12);
  }
  .h-inspector {
    position: absolute;
    top: 14px;
    bottom: 44px;
    right: 14px;
    width: 38%;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(70, 60, 50, 0.1);
  }
  .h-strip {
    position: absolute;
    left: 44px;
    right: 14px;
    bottom: 12px;
    height: 22px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .h-strip span {
    width: 30px;
    height: 20px;
    border-radius: 5px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(70, 60, 50, 0.12);
  }

  /* --- Text block --- */
  .meta {
    padding: 14px 15px 16px;
    border-top: 1px solid var(--border);
  }
  .name {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
    text-transform: lowercase;
    color: var(--text-1);
  }
  .tagline {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-2);
  }
  .caption {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-3);
  }

  /* --- Footer --- */
  .foot {
    margin-top: 34px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .notes {
    margin: 0;
    font-size: 11px;
    color: var(--text-3);
  }
  .back {
    font-size: 12px;
    color: var(--text-2);
    text-decoration: none;
  }
  .back:hover {
    color: var(--text-1);
  }
  .back:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: 4px;
  }
</style>
