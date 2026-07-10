<script lang="ts">
  // Dev-only LAB experiment: the "billboard" take on the landing page. The
  // page is a STATEMENT — a giant two-tone display headline over near-empty
  // space, with one small floating drop card as the only door in. Drops and
  // picks are REAL (IntroDropDemo runs the production import path); only the
  // editor handoff is stubbed. No production file is touched; +page.ts opts
  // this subtree out of prerender/SSR and we hard-guard on `dev` below.
  import { dev } from '$app/environment';
  import { APP_NAME } from 'shared/brand';
  import { IntroDropDemo } from '$lib/lab/intro/drop-demo.svelte';
  import Brand from '$lib/lab/intro/Brand.svelte';
  import Icon from '$lib/lab/intro/Icon.svelte';
  import ThemeToggle, {
    type ThemeMode,
  } from '$lib/lab/intro/ThemeToggle.svelte';
  import '$lib/lab/intro/intro-lab.css';

  const demo = new IntroDropDemo();

  // Lab-only forced color scheme; System adds no class and defers to the OS.
  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  // Up to four names in the accepted state; the rest fold into the summary.
  const shownFiles = $derived(demo.files.slice(0, 4));

  function browse(): void {
    fileInput?.click();
  }
</script>

{#if dev}
  <main
    class="intro-lab-root il-billboard-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    class:is-dragging={demo.dragActive}
    {@attach demo.dropTarget()}
  >
    <!-- Full-viewport accent wash, only lit while a files-drag hovers. -->
    <div class="wash" aria-hidden="true"></div>

    <input
      bind:this={fileInput}
      class="sr-only"
      type="file"
      accept="image/*"
      multiple
      tabindex="-1"
      onchange={demo.onPick}
    />

    <header class="masthead">
      <Brand size={17} />
      <div class="masthead-right">
        <span class="tag">open source</span>
        <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
      </div>
    </header>

    <section class="hero">
      <h1 class="headline reveal reveal-1">
        <span class="line-1">Smaller images.</span>
        <span class="line-2">Nothing uploaded.</span>
      </h1>

      <p class="subline reveal reveal-2">
        Free, open-source image compression that runs entirely in your browser.
        Nothing ever uploads.
      </p>

      <div class="card reveal reveal-3">
        {#if demo.hasFiles}
          <div class="zone accepted">
            <p class="summary">{demo.summary}</p>
            <ul class="filelist">
              {#each shownFiles as item (item.relativePath ?? item.file.name)}
                <li>{item.file.name}</li>
              {/each}
            </ul>
            <button type="button" class="quiet-btn" onclick={demo.reset}>
              Start over
            </button>
            <p class="stub">Lab stub — production opens the editor here.</p>
          </div>
        {:else}
          <button
            type="button"
            class="zone dropzone"
            onclick={browse}
            aria-label="Drop images here, or click to browse files"
          >
            <span class="glyph">
              <Icon name="drop-image" size={40} />
            </span>
            <span class="zone-title">
              {demo.dragActive ? 'Release to add' : 'Drop images here'}
            </span>
            <span class="browse quiet-btn">or browse files</span>
          </button>
        {/if}
      </div>

      <ul class="chips reveal reveal-3" aria-label="Supported formats">
        <li>WebP</li>
        <li>AVIF</li>
        <li>JPEG XL</li>
        <li>JPEG</li>
        <li>PNG</li>
      </ul>
    </section>

    <footer class="colophon">
      <span>{APP_NAME} — images never leave your device</span>
      <span class="colophon-right">Open source · Works offline · Free</span>
    </footer>
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .intro-lab-root {
    position: relative;
    box-sizing: border-box;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 15px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Accent wash: a viewport-wide radial glow behind everything, centred
     over the card, lit only during a files-drag. ── */
  .wash {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      680px 520px at 50% 62%,
      color-mix(in srgb, var(--il-accent) 7%, transparent),
      transparent 70%
    );
    transition: opacity 200ms ease;
  }
  .is-dragging .wash {
    opacity: 1;
  }

  /* ── Masthead: a full-width hairline row; whitespace, not a border,
     separates it from the hero. ── */
  .masthead {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px;
  }
  .masthead-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .tag {
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--il-text-3);
  }

  /* ── Hero: the statement. ── */
  .hero {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(18px, 3vh, 40px);
    padding: 16px 24px clamp(16px, 3vh, 40px);
    text-align: center;
  }

  .headline {
    margin: 0;
    display: flex;
    flex-direction: column;
    /* Width-driven, but capped against short viewports too so the single
       section genuinely fits 100dvh on squat laptop windows. */
    font-size: min(clamp(44px, 8.5vw, 108px), 13.5vh);
    font-weight: 900;
    line-height: 0.98;
    letter-spacing: -0.035em;
  }
  .line-1 {
    color: var(--il-text-1);
  }
  .line-2 {
    color: var(--il-accent);
  }

  .subline {
    margin: 0;
    max-width: 46ch;
    font-size: 17px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--il-text-2);
  }

  /* ── The card: the only door in. ── */
  .card {
    box-sizing: border-box;
    width: min(560px, calc(100vw - 48px));
    padding: 22px;
    background: var(--il-surface);
    border: 1px solid var(--il-border);
    border-radius: 22px;
    box-shadow: var(--il-shadow-card);
    transition:
      transform 200ms ease,
      box-shadow 200ms ease;
  }
  @supports (corner-shape: squircle) {
    .card {
      corner-shape: squircle;
      border-radius: 28px;
    }
  }
  .is-dragging .card {
    transform: translateY(-3px) scale(1.015);
  }

  .zone {
    box-sizing: border-box;
    width: 100%;
    min-height: 190px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 28px 20px;
    border: 1.5px dashed var(--il-border-strong);
    border-radius: 14px;
    background: var(--il-inset);
    text-align: center;
    transition:
      border-color 200ms ease,
      background-color 200ms ease;
  }
  @supports (corner-shape: squircle) {
    .zone {
      corner-shape: squircle;
      border-radius: 18px;
    }
  }

  /* The dropzone is a real button so the whole zone opens the picker. */
  .dropzone {
    font: inherit;
    color: inherit;
    cursor: pointer;
    appearance: none;
  }
  .is-dragging .zone {
    border-color: var(--il-accent);
    background: color-mix(in srgb, var(--il-accent) 6%, var(--il-inset));
  }

  .glyph {
    display: inline-grid;
    color: var(--il-text-2);
    transition: color 150ms ease;
  }
  .is-dragging .glyph {
    color: var(--il-accent);
  }
  .zone-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--il-text-1);
  }

  .quiet-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    font: inherit;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--il-text-1);
    background: var(--il-surface);
    border: 1px solid var(--il-border);
    border-radius: 10px;
    box-shadow: var(--il-shadow-control);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .quiet-btn {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .quiet-btn:hover {
    border-color: var(--il-border-strong);
    background: var(--il-raise);
  }

  /* ── Accepted state: the stub confirmation, same footprint as idle. ── */
  .accepted {
    gap: 10px;
  }
  .summary {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--il-text-1);
  }
  .filelist {
    margin: 0;
    padding: 0;
    list-style: none;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .filelist li {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--il-text-2);
  }
  .stub {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--il-text-3);
  }

  /* ── Format chips. ── */
  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chips li {
    padding: 4px 11px;
    font-size: 12px;
    font-weight: 500;
    color: var(--il-text-3);
    border: 1px solid var(--il-border);
    border-radius: 999px;
  }

  /* ── Colophon: hairline-topped footer, part of the section. ── */
  .colophon {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 28px;
    border-top: 1px solid var(--il-border);
    font-size: 12.5px;
    color: var(--il-text-3);
  }
  .colophon-right {
    text-align: right;
  }

  /* ── One entrance reveal: headline, subline, card rise + fade, staggered. ── */
  .reveal {
    animation: reveal 400ms ease-out both;
  }
  .reveal-1 {
    animation-delay: 0ms;
  }
  .reveal-2 {
    animation-delay: 80ms;
  }
  .reveal-3 {
    animation-delay: 160ms;
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 560px) {
    .colophon {
      flex-direction: column;
      gap: 4px;
      text-align: center;
    }
    .colophon-right {
      text-align: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal {
      animation: none;
    }
    .card,
    .is-dragging .card {
      transform: none;
    }
    .card {
      transition:
        box-shadow 200ms ease,
        border-color 200ms ease;
    }
  }
</style>
