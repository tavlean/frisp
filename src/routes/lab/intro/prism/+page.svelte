<script lang="ts">
  // Dev-only LAB experiment: the "prism" take on the landing page. A three-zone
  // hero — headline block LEFT, a luminous drop STAGE centre-right with a
  // prismatic glow behind the brand mark, a slim micro-copy column FAR RIGHT —
  // over a quiet format row. Drops and picks are REAL (IntroDropDemo runs the
  // production import path); only the editor handoff is stubbed. No production
  // file is touched; +page.ts opts this subtree out of prerender/SSR and we
  // hard-guard on `dev` below.
  import { dev } from '$app/environment';
  import { asset } from '$app/paths';
  import { APP_NAME } from 'shared/brand';
  import { IntroDropDemo } from '$lib/lab/intro/drop-demo.svelte';
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

  // "Try a sample" mints a genuine File so the accepted state is honest — an
  // 800×600 painted gradient, exactly what a real pick would feed the editor.
  function trySample(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#f6b26b');
    grad.addColorStop(0.6, '#e4602f');
    grad.addColorStop(1, '#7a2d5f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 40; i += 1) {
      const r = 4 + Math.random() * 26;
      ctx.beginPath();
      ctx.arc(Math.random() * 800, Math.random() * 600, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'sample-sunset.png', { type: 'image/png' });
      demo.accept([{ file }]);
    }, 'image/png');
  }

  // The stage is one big hit target while idle; once files land it becomes a
  // static panel, so the click must never reopen the picker mid-confirmation.
  function stageClick(): void {
    if (demo.hasFiles) return;
    browse();
  }
</script>

{#if dev}
  <main
    class="intro-lab-root il-prism-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    class:is-dragging={demo.dragActive}
    class:has-files={demo.hasFiles}
    {@attach demo.dropTarget()}
  >
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
      <a class="brand" href="/" aria-label={APP_NAME}>
        <img
          class="brand-mark"
          src={asset('/logo.webp')}
          alt=""
          width="22"
          height="22"
        />
        <span class="wordmark">{APP_NAME}</span>
      </a>
      <div class="masthead-right">
        <span class="tag">open source</span>
        <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
      </div>
    </header>

    <section class="hero">
      <!-- LEFT: the statement + the actions. -->
      <div class="pitch">
        <h1 class="headline reveal reveal-1">
          <span>Compress</span>
          <span>images.</span>
        </h1>
        <p class="subline reveal reveal-2">
          Drag, drop, done.<br />
          Everything stays on your device.
        </p>
        <div class="actions reveal reveal-3">
          <button type="button" class="btn btn-primary" onclick={browse}>
            Browse files
          </button>
          <button type="button" class="btn btn-ghost" onclick={trySample}>
            Try a sample
          </button>
        </div>
      </div>

      <!-- CENTRE: the luminous drop stage. -->
      <div class="stage reveal reveal-3">
        <div class="glow" aria-hidden="true"></div>
        <div class="boundary" aria-hidden="true"></div>

        {#if demo.hasFiles}
          <div class="stage-inner accepted">
            <img
              class="mark accepted-mark"
              src={asset('/logo.webp')}
              alt=""
              width="56"
              height="56"
            />
            <p class="summary">{demo.summary}</p>
            <ul class="filelist">
              {#each shownFiles as item (item.relativePath ?? item.file.name)}
                <li>{item.file.name}</li>
              {/each}
            </ul>
            <button
              type="button"
              class="btn btn-ghost quiet"
              onclick={(e) => {
                e.stopPropagation();
                demo.reset();
              }}
            >
              Start over
            </button>
            <p class="stub">Lab stub — production opens the editor here.</p>
          </div>
        {:else}
          <button
            type="button"
            class="stage-inner stage-hit"
            onclick={stageClick}
            aria-label="Drop images here, or click to browse files"
          >
            <img
              class="mark"
              src={asset('/logo.webp')}
              alt=""
              width="104"
              height="104"
            />
            <span class="tray"><Icon name="drop-tray" size={26} /></span>
            <span class="drop-title">
              {demo.dragActive ? 'Release to add' : 'Drag & drop images'}
            </span>
            <span class="drop-sub">or click to browse</span>
            <span class="drop-chips">
              <span class="chip">images</span>
              <span class="chip">folders/</span>
            </span>
          </button>
        {/if}
      </div>

      <!-- RIGHT: the slim trust column. -->
      <ul class="micro" aria-label="What frisp does with your images">
        <li>Everything local</li>
        <li>Nothing uploaded</li>
        <li>Open source · Free</li>
      </ul>
    </section>

    <footer class="baseline">
      <ul class="formats" aria-label="Supported formats">
        <li>WebP</li>
        <li>AVIF</li>
        <li>JPEG XL</li>
        <li>JPEG</li>
        <li>PNG</li>
      </ul>
      <p class="colophon">{APP_NAME} — images never leave your device</p>
    </footer>
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .intro-lab-root {
    /* Glow alpha rides on layer opacity so one gradient serves both modes:
       pastel-luminous in light, backlit-glass in dark. */
    --pr-glow-op: light-dark(0.68, 1);
    --pr-glow-op-hot: light-dark(0.86, 1);

    position: relative;
    box-sizing: border-box;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
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

  /* ── Masthead ── */
  .masthead {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 28px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
    color: inherit;
  }
  .brand-mark {
    display: block;
  }
  .wordmark {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--il-text-1);
  }
  .masthead-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tag {
    font-size: 11.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--il-text-3);
  }

  /* ── Hero: three zones ── */
  .hero {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns:
      minmax(240px, 0.8fr)
      minmax(0, 1.6fr)
      minmax(150px, 0.5fr);
    align-items: center;
    gap: clamp(20px, 3.5vw, 56px);
    padding: 0 clamp(24px, 4vw, 64px);
  }

  /* LEFT — the statement. */
  .headline {
    margin: 0;
    display: flex;
    flex-direction: column;
    font-size: clamp(36px, 4.6vw, 62px);
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -0.03em;
    color: var(--il-text-1);
  }
  .subline {
    margin: 14px 0 0;
    font-size: 16px;
    line-height: 1.5;
    color: var(--il-text-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 22px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    font: inherit;
    font-weight: 650;
    border-radius: 999px;
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      transform 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .btn-primary {
    background: var(--il-text-1);
    color: var(--il-page);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: transparent;
    color: var(--il-text-1);
    border-color: var(--il-border-strong);
  }
  .btn-ghost:hover {
    border-color: var(--il-text-2);
    background: color-mix(in srgb, var(--il-text-1) 5%, transparent);
  }

  /* CENTRE — the stage. */
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 0.92;
    max-height: min(62dvh, 560px);
    margin: auto;
    overflow: hidden;
    border-radius: 28px;
  }
  @supports (corner-shape: squircle) {
    .stage {
      corner-shape: squircle;
      border-radius: 34px;
    }
  }

  /* 1 — prismatic glow: four low-alpha radials blooming from the centre,
     heavily blurred, clipped to the stage silhouette by the parent. */
  .glow {
    position: absolute;
    inset: 6%;
    border-radius: 26px;
    opacity: var(--pr-glow-op);
    filter: blur(clamp(24px, 4vw, 48px));
    background:
      radial-gradient(
        58% 55% at 34% 36%,
        rgba(255, 138, 94, 0.55),
        transparent 70%
      ),
      radial-gradient(
        54% 54% at 68% 32%,
        rgba(83, 178, 255, 0.5),
        transparent 68%
      ),
      radial-gradient(
        60% 58% at 38% 72%,
        rgba(61, 220, 151, 0.44),
        transparent 70%
      ),
      radial-gradient(
        54% 56% at 68% 68%,
        rgba(177, 140, 255, 0.5),
        transparent 70%
      );
    transition:
      opacity 250ms ease,
      transform 250ms ease;
  }
  .is-dragging .glow {
    opacity: var(--pr-glow-op-hot);
    transform: scale(1.04);
  }

  /* 2 — dashed boundary. */
  .boundary {
    position: absolute;
    inset: 0;
    border: 1.5px dashed var(--il-border-strong);
    border-radius: 28px;
    background: transparent;
    transition: border-color 250ms ease;
  }
  @supports (corner-shape: squircle) {
    .boundary {
      corner-shape: squircle;
      border-radius: 34px;
    }
  }
  .is-dragging .boundary {
    border-color: var(--il-accent);
  }

  /* 3 — content: a single hit-target button filling the stage. */
  .stage-inner {
    position: absolute;
    inset: 0;
    display: grid;
    grid-auto-flow: row;
    place-content: center;
    justify-items: center;
    gap: 14px;
    padding: 24px;
    text-align: center;
  }
  .stage-hit {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    cursor: pointer;
    appearance: none;
  }

  .mark {
    width: clamp(72px, 9vw, 104px);
    height: auto;
    filter: drop-shadow(0 10px 30px rgba(255, 122, 80, 0.28));
  }
  .tray {
    display: inline-grid;
    color: var(--il-text-2);
  }
  .drop-title {
    font-size: 17px;
    font-weight: 750;
    color: var(--il-text-1);
  }
  .drop-sub {
    font-size: 13.5px;
    color: var(--il-text-3);
  }
  .drop-chips {
    display: inline-flex;
    gap: 8px;
    margin-top: 6px;
  }
  .chip {
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--il-text-2);
    background: var(--il-surface);
    border: 1px solid var(--il-border);
    border-radius: 999px;
  }

  /* Accepted state — same footprint, no jump. */
  .accepted {
    gap: 10px;
  }
  .accepted-mark {
    width: 56px;
    filter: none;
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
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 100%;
  }
  .filelist li {
    max-width: 34ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--il-text-2);
  }
  .quiet {
    padding: 8px 16px;
    font-size: 13.5px;
    font-weight: 600;
  }
  .stub {
    margin: 2px 0 0;
    font-size: 11.5px;
    color: var(--il-text-3);
  }

  /* RIGHT — the trust column. */
  .micro {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
  }
  .micro li {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--il-text-3);
    font-variant-numeric: tabular-nums;
  }

  /* ── Baseline row: formats + colophon, doubling as the footer. ── */
  .baseline {
    flex: none;
    padding: 22px 28px 26px;
    text-align: center;
  }
  .formats {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: clamp(22px, 5vw, 64px);
  }
  .formats li {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--il-text-3);
  }
  .colophon {
    margin: 10px 0 0;
    font-size: 11.5px;
    color: var(--il-text-3);
  }

  /* ── One entrance reveal, staggered; stage + glow fade in. ── */
  .reveal {
    animation: reveal 450ms ease-out both;
  }
  .reveal-1 {
    animation-delay: 40ms;
  }
  .reveal-2 {
    animation-delay: 120ms;
  }
  .reveal-3 {
    animation-delay: 200ms;
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
  .glow {
    animation: glow-in 500ms ease-out both;
  }
  @keyframes glow-in {
    from {
      opacity: 0;
    }
  }

  /* ── Responsive: collapse to a single column, allow the page to scroll. ── */
  @media (max-width: 1020px) {
    .hero {
      grid-template-columns: 1fr;
      justify-items: center;
      gap: clamp(24px, 5vw, 44px);
      padding: 8px clamp(24px, 5vw, 48px) 24px;
    }
    .pitch {
      text-align: center;
    }
    .headline {
      align-items: center;
    }
    .actions {
      justify-content: center;
    }
    .stage {
      max-width: 520px;
    }
    .micro {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px 22px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal,
    .glow {
      animation: none;
    }
    .btn-primary:hover {
      transform: none;
    }
    .is-dragging .glow {
      transform: none;
    }
  }
</style>
