<script lang="ts">
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

  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  const shownFiles = $derived(demo.files.slice(0, 4));

  function openPicker(): void {
    if (demo.hasFiles) return;
    fileInput?.click();
  }

  function reset(event: MouseEvent): void {
    event.stopPropagation();
    demo.reset();
  }
</script>

{#if dev}
  <main
    class="intro-lab-root il-ledger-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    {@attach demo.dropTarget()}
  >
    <input
      bind:this={fileInput}
      class="file-input"
      type="file"
      accept="image/*"
      multiple
      onchange={demo.onPick}
    />

    <!-- Header, column, and footer all share ONE spine (the same centred
         560px measure), so the wordmark, headline, tray, ledger rows, and
         footer text align on a single left edge — the editorial move that
         makes the narrow-column concept read as deliberate. -->
    <header class="ledger-header">
      <div class="spine header-row">
        <Brand size={16} />
        <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
      </div>
    </header>

    <section class="ledger-stage">
      <div class="spine ledger-column">
        <h1>
          {APP_NAME} compresses images without uploading them.
        </h1>

        <div class:drag-active={demo.dragActive} class="tray-wrap">
          <button
            type="button"
            class="tray"
            class:accepted={demo.hasFiles}
            onclick={openPicker}
            aria-label={demo.hasFiles
              ? demo.summary
              : 'Drop images, or click to browse files'}
          >
            {#if demo.hasFiles}
              <span class="accepted-content">
                <span class="summary">{demo.summary}</span>
                <span class="file-names">
                  {#each shownFiles as item (item.relativePath ?? item.file.name)}
                    <span class="file-name">{item.file.name}</span>
                  {/each}
                </span>
                <span class="stub"
                  >Lab stub — production opens the editor here.</span
                >
              </span>
            {:else}
              <span class="idle-content">
                <span class="tray-glyph">
                  <Icon name="drop-tray" size={40} />
                </span>
                <span class="tray-copy">
                  {demo.dragActive ? 'Release to add' : 'Drop images here'}
                </span>
                {#if !demo.dragActive}
                  <span class="tray-hint">or click to browse</span>
                {/if}
              </span>
            {/if}
          </button>

          {#if demo.hasFiles}
            <button type="button" class="reset-button" onclick={reset}
              >Start over</button
            >
          {/if}
        </div>

        <dl class="ledger">
          <div class="ledger-row">
            <dt class="number">01</dt>
            <dt class="step">Decode</dt>
            <dd>in your browser</dd>
          </div>
          <div class="ledger-row">
            <dt class="number">02</dt>
            <dt class="step">Resize &amp; palette</dt>
            <dd>optional, per image</dd>
          </div>
          <div class="ledger-row">
            <dt class="number">03</dt>
            <dt class="step">Encode</dt>
            <dd>WebP · AVIF · JPEG XL · JPEG · PNG</dd>
          </div>
          <div class="ledger-row">
            <dt class="number">04</dt>
            <dt class="step">Upload</dt>
            <dd class="never">never</dd>
          </div>
        </dl>
      </div>
    </section>

    <footer class="ledger-footer">
      <div class="spine footer-row">
        <span>{APP_NAME} — images never leave your device</span>
        <span>Open source · Works offline</span>
      </div>
    </footer>
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .il-ledger-root {
    box-sizing: border-box;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-size: 15px;
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
  }

  /* The shared measure: everything sits on this one centred column. */
  .spine {
    width: min(560px, calc(100vw - 48px));
    margin: 0 auto;
  }

  .ledger-header {
    padding: 18px 0;
  }
  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .ledger-stage {
    flex: 1 1 auto;
    display: grid;
    place-items: center;
    /* Slight bottom bias lifts the column just above optical centre. */
    padding: 12px 0 40px;
  }

  .ledger-column {
    display: flex;
    flex-direction: column;
    /* Headline binds tightly to the tray (its answer); the ledger gets more
       air so it reads as the supporting exhibit, not part of the control. */
    gap: 0;
  }
  .ledger-column h1 {
    margin-bottom: 22px;
  }
  .ledger-column .tray-wrap {
    margin-bottom: 36px;
  }

  h1 {
    margin: 0;
    color: var(--il-text-1);
    font-size: clamp(24px, 3.6vw, 38px);
    font-weight: 750;
    line-height: 1.15;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }

  .tray-wrap {
    position: relative;
    width: 100%;
    height: 200px;
  }

  .tray {
    width: 100%;
    height: 200px;
    display: grid;
    place-items: center;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--il-border-strong);
    border-radius: 18px;
    background: var(--il-inset);
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      border-color 180ms ease,
      background-color 180ms ease;
  }

  @supports (corner-shape: squircle) {
    .tray {
      corner-shape: squircle;
      border-radius: 22px;
    }
  }

  .tray.accepted {
    cursor: default;
  }

  .tray:hover:not(.accepted) {
    border-color: var(--il-border-strong);
    background: color-mix(in srgb, var(--il-text-1) 2.5%, var(--il-inset));
  }

  .drag-active .tray {
    border-color: var(--il-accent);
    background: color-mix(in srgb, var(--il-accent) 7%, var(--il-inset));
  }

  .idle-content {
    display: grid;
    justify-items: center;
    gap: 8px;
  }

  .tray-glyph {
    display: inline-grid;
    color: var(--il-text-2);
    transition: transform 180ms ease;
  }

  .drag-active .tray-glyph {
    transform: translateY(3px);
  }

  .tray-copy {
    color: var(--il-text-1);
    font-size: 15px;
    font-weight: 650;
  }

  .tray-hint {
    color: var(--il-text-3);
    font-size: 12.5px;
  }

  .reset-button {
    color: var(--il-accent-2);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .accepted-content {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 18px 52px;
    overflow: hidden;
  }

  .summary {
    flex: 0 0 auto;
    color: var(--il-text-1);
    font-size: 17px;
    font-weight: 800;
  }

  .file-names {
    width: min(100%, 44ch);
    display: grid;
    margin-top: 5px;
    overflow: hidden;
  }

  .file-name {
    display: block;
    overflow: hidden;
    color: var(--il-text-2);
    font-size: 12.5px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stub {
    position: absolute;
    right: 18px;
    bottom: 13px;
    left: 18px;
    overflow: hidden;
    color: var(--il-text-3);
    font-size: 11.5px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reset-button {
    position: absolute;
    z-index: 1;
    bottom: 34px;
    left: 50%;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transform: translateX(-50%);
  }

  .ledger {
    margin: 0;
  }

  .ledger-row {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: baseline;
    padding: 13px 0;
    border-top: 1px solid var(--il-border);
  }

  .ledger-row:last-child {
    border-bottom: 1px solid var(--il-border);
  }

  .ledger dt,
  .ledger dd {
    margin: 0;
  }

  .number {
    color: var(--il-text-3);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .step {
    color: var(--il-text-1);
    font-size: 14.5px;
    font-weight: 650;
  }

  .ledger dd {
    color: var(--il-text-2);
    font-size: 13px;
    text-align: right;
  }

  .ledger dd.never {
    color: var(--il-accent);
    font-weight: 750;
  }

  .ledger-footer {
    padding: 16px 0 20px;
    color: var(--il-text-3);
    font-size: 12.5px;
  }
  .footer-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .tray-glyph,
    .drag-active .tray-glyph {
      transform: none;
      transition: none;
    }
  }
</style>
