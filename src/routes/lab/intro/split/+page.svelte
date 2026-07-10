<script lang="ts">
  import { dev } from '$app/environment';
  import ThemeToggle, {
    type ThemeMode,
  } from '$lib/lab/intro/ThemeToggle.svelte';
  import { IntroDropDemo } from '$lib/lab/intro/drop-demo.svelte';
  import Brand from '$lib/lab/intro/Brand.svelte';
  import Icon from '$lib/lab/intro/Icon.svelte';
  import { APP_NAME } from 'shared/brand';
  import '$lib/lab/intro/intro-lab.css';

  type Sample = {
    name: 'sunset' | 'sea' | 'meadow';
    angle: number;
    stops: [number, string][];
  };

  const demo = new IntroDropDemo();
  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  const samples: Sample[] = [
    {
      name: 'sunset',
      angle: 135,
      stops: [
        [0, '#f6b26b'],
        [0.6, '#e4602f'],
        [1, '#7a2d5f'],
      ],
    },
    {
      name: 'sea',
      angle: 135,
      stops: [
        [0, '#9bd7ff'],
        [0.55, '#2276c9'],
        [1, '#123a63'],
      ],
    },
    {
      name: 'meadow',
      angle: 160,
      stops: [
        [0, '#d9f0a3'],
        [0.55, '#58a35b'],
        [1, '#1f5c37'],
      ],
    },
  ];

  function openPicker(): void {
    fileInput?.click();
  }

  function onZoneKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPicker();
  }

  function makeGradient(
    context: CanvasRenderingContext2D,
    sample: Sample,
  ): CanvasGradient {
    const radians = (sample.angle * Math.PI) / 180;
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);
    const length = Math.abs(800 * dx) + Math.abs(600 * dy);
    const gradient = context.createLinearGradient(
      400 - (dx * length) / 2,
      300 - (dy * length) / 2,
      400 + (dx * length) / 2,
      300 + (dy * length) / 2,
    );

    for (const [offset, color] of sample.stops) {
      gradient.addColorStop(offset, color);
    }
    return gradient;
  }

  function useSample(sample: Sample): void {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = makeGradient(context, sample);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.globalAlpha = 0.06;
    for (let index = 0; index < 40; index += 1) {
      const radius = 4 + Math.random() * 26;
      context.beginPath();
      context.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        radius,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `sample-${sample.name}.png`, {
        type: 'image/png',
      });
      demo.accept([{ file }]);
    }, 'image/png');
  }
</script>

{#if dev}
  <main
    class="intro-lab-root il-split-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    class:drag-active={demo.dragActive}
    {@attach demo.dropTarget()}
  >
    <header class="site-header">
      <Brand size={17} />
      <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
    </header>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">PRIVATE IMAGE COMPRESSION</p>
        <h1>Compress images. Right here, <span>locally.</span></h1>
        <p class="subline">
          Free, open-source image compression that runs entirely in your
          browser. Nothing ever uploads.
        </p>

        <div class="stats" aria-label="Product highlights">
          <div class="stat">
            <strong>7 codecs</strong>
            <span>rebuilt from source</span>
          </div>
          <div class="stat">
            <strong>Multi-core</strong>
            <span>WASM encoders</span>
          </div>
          <div class="stat">
            <strong>0 uploads</strong>
            <span>ever</span>
          </div>
        </div>
      </div>

      <div class="drop-panel">
        <div
          class="drop-zone"
          role="button"
          tabindex="0"
          aria-label="Choose images to compress"
          onclick={(event) => {
            if (!(event.target as HTMLElement).closest('button')) openPicker();
          }}
          onkeydown={onZoneKeydown}
        >
          {#if demo.hasFiles}
            <div class="accepted-state">
              <p class="summary">{demo.summary}</p>
              <div class="file-list">
                {#each demo.files.slice(0, 4) as item (item.file)}
                  <span title={item.file.name}>{item.file.name}</span>
                {/each}
              </div>
              <button
                type="button"
                class="quiet-button"
                onclick={() => demo.reset()}
              >
                Start over
              </button>
              <p class="stub">Lab stub — production opens the editor here.</p>
            </div>
          {:else}
            <div class="idle-state">
              <span class="image-glyph">
                <Icon name="drop-image" size={44} />
              </span>
              <p class="drop-title">
                {demo.dragActive ? 'Release to add' : 'Drop images here'}
              </p>
              <button type="button" class="quiet-button" onclick={openPicker}>
                or browse files
              </button>
              <div class="chips" aria-label="Supported formats">
                <span>WebP</span>
                <span>AVIF</span>
                <span>JPEG XL</span>
                <span>JPEG</span>
                <span>PNG</span>
              </div>
            </div>
          {/if}
        </div>

        {#if !demo.hasFiles}
          <div class="sample-strip">
            <span class="sample-caption">No image handy? Try a sample:</span>
            <div class="sample-buttons">
              {#each samples as sample (sample.name)}
                <button
                  type="button"
                  class="sample-button {sample.name}"
                  aria-label="Try the {sample.name} sample"
                  onclick={() => useSample(sample)}
                ></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </section>

    <footer class="site-footer">
      <span>{APP_NAME} — images never leave your device</span>
      <span>Open source · Works offline · Free</span>
    </footer>

    <input
      class="visually-hidden"
      bind:this={fileInput}
      type="file"
      accept="image/*"
      multiple
      onchange={demo.onPick}
    />
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  :global(body) {
    margin: 0;
  }

  .il-split-root {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .site-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 30px;
  }

  .hero {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    gap: clamp(28px, 5vw, 72px);
    align-items: center;
    padding: 0 clamp(24px, 5vw, 72px);
  }

  .hero-copy {
    min-width: 0;
  }

  .eyebrow {
    margin: 0;
    color: var(--il-text-3);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 11ch;
    margin: 13px 0 0;
    color: var(--il-text-1);
    font-size: clamp(38px, 5.5vw, 72px);
    font-weight: 900;
    line-height: 1.02;
    letter-spacing: -0.03em;
  }

  h1 span {
    color: var(--il-accent);
  }

  .subline {
    max-width: 42ch;
    margin: 14px 0 0;
    color: var(--il-text-2);
    font-size: 16.5px;
    line-height: 1.5;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 24px 34px;
    margin-top: 34px;
  }

  .stat {
    min-width: 120px;
    padding-top: 12px;
    border-top: 1px solid var(--il-border);
  }

  .stat strong,
  .stat span {
    display: block;
  }

  .stat strong {
    color: var(--il-text-1);
    font-size: 17px;
    font-weight: 800;
  }

  .stat span {
    margin-top: 3px;
    color: var(--il-text-3);
    font-size: 12.5px;
  }

  .drop-panel {
    height: min(560px, 68dvh);
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 12px;
    border: 1px solid var(--il-border);
    border-radius: 24px;
    background: var(--il-surface);
    box-shadow: var(--il-shadow-card);
    transition: transform 200ms ease;
  }

  @supports (corner-shape: squircle) {
    .drop-panel {
      corner-shape: squircle;
      border-radius: 30px;
    }
  }

  .drag-active .drop-panel {
    transform: translateY(-2px);
  }

  .drop-zone {
    min-height: 0;
    flex: 1;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 24px;
    border: 1.5px dashed var(--il-border-strong);
    border-radius: 16px;
    background: var(--il-inset);
    text-align: center;
    cursor: pointer;
    transition:
      border-color 200ms ease,
      background-color 200ms ease;
  }

  .drag-active .drop-zone {
    border-color: var(--il-accent);
    background: color-mix(in srgb, var(--il-accent) 6%, var(--il-inset));
  }

  .idle-state,
  .accepted-state {
    display: grid;
    justify-items: center;
  }

  .image-glyph {
    display: inline-grid;
    color: var(--il-text-2);
    transition: color 150ms ease;
  }

  .drop-title {
    margin: 18px 0 13px;
    color: var(--il-text-1);
    font-size: 16px;
    font-weight: 700;
  }

  .quiet-button {
    padding: 8px 16px;
    border: 1px solid var(--il-border);
    border-radius: 10px;
    background: var(--il-surface);
    color: var(--il-text-1);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--il-shadow-control);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 22px;
  }

  .chips span {
    padding: 3px 9px;
    border: 1px solid var(--il-border);
    border-radius: 999px;
    color: var(--il-text-3);
    font-size: 11.5px;
    line-height: 1.35;
  }

  .accepted-state {
    width: min(100%, 420px);
  }

  .summary {
    margin: 0 0 17px;
    color: var(--il-text-1);
    font-size: 18px;
    font-weight: 800;
  }

  .file-list {
    width: 100%;
    display: grid;
    justify-items: center;
    gap: 6px;
    margin-bottom: 21px;
  }

  .file-list span {
    display: block;
    max-width: 36ch;
    overflow: hidden;
    color: var(--il-text-2);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stub {
    margin: 14px 0 0;
    color: var(--il-text-3);
    font-size: 12px;
  }

  .sample-strip {
    flex: none;
    padding: 14px 10px 6px;
  }

  .sample-caption {
    display: block;
    margin-bottom: 9px;
    color: var(--il-text-3);
    font-size: 12.5px;
  }

  .sample-buttons {
    display: flex;
    gap: 10px;
  }

  .sample-button {
    width: 64px;
    height: 46px;
    flex: none;
    overflow: hidden;
    padding: 0;
    border: 1px solid var(--il-border);
    border-radius: 10px;
    cursor: pointer;
  }

  .sample-button.sunset {
    background: linear-gradient(135deg, #f6b26b, #e4602f 60%, #7a2d5f);
  }

  .sample-button.sea {
    background: linear-gradient(135deg, #9bd7ff, #2276c9 55%, #123a63);
  }

  .sample-button.meadow {
    background: linear-gradient(160deg, #d9f0a3, #58a35b 55%, #1f5c37);
  }

  .site-footer {
    flex: none;
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 30px;
    border-top: 1px solid var(--il-border);
    color: var(--il-text-3);
    font-size: 12.5px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 879px) {
    .il-split-root {
      min-height: 100dvh;
    }

    .hero {
      grid-template-columns: minmax(0, 1fr);
      padding-top: 28px;
      padding-bottom: 42px;
    }

    .drop-panel {
      grid-row: 1;
      height: min(560px, 68dvh);
      min-height: 430px;
    }

    .hero-copy {
      grid-row: 2;
    }
  }

  @media (max-width: 560px) {
    .site-header {
      padding: 18px 20px;
    }

    .hero {
      padding-right: 20px;
      padding-left: 20px;
    }

    .drop-panel {
      min-height: 410px;
    }

    .drop-zone {
      padding: 20px 14px;
    }

    .site-footer {
      flex-direction: column;
      gap: 5px;
      padding: 14px 20px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drop-panel {
      transition: none;
    }

    .drag-active .drop-panel {
      transform: none;
    }
  }
</style>
