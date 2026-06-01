<script lang="ts">
  // Ported from src/client/lazy-app/Compress/Results/{index.tsx,style.css}.
  // The download "blob" button + speech-bubble showing the output filesize and
  // a percentage badge with a directional arrow. Themed per side via the
  // inherited --main-theme-color / --hot-theme-color custom properties.

  interface Props {
    /** Which side this bubble belongs to — controls the layout mirroring. */
    side: 'left' | 'right';
    /** Output size in bytes (null while encoding / before first result). */
    size: number | null;
    /** Signed percent change vs the original (negative = smaller = good). */
    percent: number | null;
    /** True for the Original/identity side: hides the coloured percent badge. */
    isOriginal: boolean;
    downloadHref: string;
    downloadName: string;
    /** Short format label shown next to the size on narrow layouts. */
    typeLabel: string;
    loading: boolean;
    disabled: boolean;
  }

  let {
    side,
    size,
    percent,
    isOriginal,
    downloadHref,
    downloadName,
    typeLabel,
    loading,
    disabled,
  }: Props = $props();

  // Decimal (SI, base-1000) units with 3 significant figures, matching the
  // original's Results/pretty-bytes.ts (so displayed sizes are identical).
  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  function prettySize(bytes: number): { value: string; unit: string } {
    if (bytes < 1) return { value: '0', unit: 'B' };
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return {
      value: (bytes / 1000 ** exponent).toPrecision(3),
      unit: SIZE_UNITS[exponent],
    };
  }

  const pretty = $derived(size === null ? null : prettySize(size));
  const direction = $derived(
    isOriginal || percent === null || percent === 0
      ? null
      : percent < 0
        ? 'down'
        : 'up',
  );
  const percentMagnitude = $derived(
    percent === null ? '' : String(Math.abs(Math.round(percent))),
  );
</script>

<div
  class="results"
  class:results-right={side === 'right'}
  class:results-left={side === 'left'}
  class:is-original={isOriginal}
>
  <div class="bubble">
    <div class="bubble-inner">
      <div class="size-info">
        <div class="file-size">
          {#if pretty}
            {pretty.value}
            <span class="unit">{pretty.unit}</span>
            <span class="type-label"> {typeLabel}</span>
          {:else}
            …
          {/if}
        </div>
      </div>
      <div class="percent-info">
        <svg viewBox="0 0 1 2" class="big-arrow" preserveAspectRatio="none">
          <path d="M1 0v2L0 1z" />
        </svg>
        <div class="percent-output">
          {#if direction}
            <span class="size-direction"
              >{direction === 'down' ? '↓' : '↑'}</span
            >
          {/if}
          <span class="size-value">{percentMagnitude}</span>
          <span class="percent-char">%</span>
        </div>
      </div>
    </div>
  </div>
  <a
    class="download"
    class:download-disable={disabled}
    href={disabled ? undefined : downloadHref}
    download={disabled ? undefined : downloadName}
    title="Download"
    aria-disabled={disabled}
  >
    <svg class="download-blobs" viewBox="0 0 89.6 86.9">
      <title>Download</title>
      <path
        d="M27.3 72c-8-4-15.6-12.3-16.9-21-1.2-8.7 4-17.8 10.5-26s14.4-15.6 24-16 21.2 6 28.6 16.5c7.4 10.5 10.8 25 6.6 34S64.1 71.8 54 73.6c-10.2 2-18.7 2.3-26.7-1.6z"
      />
      <path
        d="M19.8 24.8c4.3-7.8 13-15 21.8-15.7 8.7-.8 17.5 4.8 25.4 11.8 7.8 6.9 14.8 15.2 14.7 24.9s-7.1 20.7-18 27.6c-10.8 6.8-25.5 9.5-34.2 4.8S18.1 61.6 16.7 51.4c-1.3-10.3-1.3-18.8 3-26.6z"
      />
    </svg>
    <div class="download-icon">
      <svg viewBox="0 0 23.9 24.9">
        <path
          d="M6.6 2.7h-4v13.2h2.7A2.7 2.7 0 018 18.6a2.7 2.7 0 002.6 2.6h2.7a2.7 2.7 0 002.6-2.6 2.7 2.7 0 012.7-2.7h2.6V2.7h-4a1.3 1.3 0 110-2.7h4A2.7 2.7 0 0124 2.7v18.5a2.7 2.7 0 01-2.7 2.7H2.7A2.7 2.7 0 010 21.2V2.7A2.7 2.7 0 012.7 0h4a1.3 1.3 0 010 2.7zm4 7.4V1.3a1.3 1.3 0 112.7 0v8.8L15 8.4a1.3 1.3 0 011.9 1.8l-4 4a1.3 1.3 0 01-1.9 0l-4-4A1.3 1.3 0 019 8.4z"
        />
      </svg>
    </div>
    {#if loading}
      <span class="spinner" aria-hidden="true"></span>
    {/if}
  </a>
</div>

<style>
  @font-face {
    font-family: 'Roboto Mono Numbers';
    font-style: normal;
    font-weight: 700;
    src: url('data:font/woff;base64,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')
      format('woff');
  }

  .results {
    --download-overflow-size: 30px;
    display: grid;
    grid-template-columns: [download] auto [bubble] 1fr;
    align-items: center;
    margin-bottom: calc(var(--download-overflow-size) / 2);
    min-width: 0;
  }
  .results-right {
    grid-template-columns: [bubble] 1fr [download] auto;
  }

  .bubble {
    align-self: center;
    position: relative;
    width: max-content;
    grid-row: 1;
    grid-column: bubble;
  }
  .bubble::before {
    content: '';
    position: absolute;
    inset: 0;
    border-image-source: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='186.5' height='280.3' viewBox='0 0 186.5 280.3'%3E%3Cpath fill='rgba(30,31,29,0.69)' d='M181.5 0H16.4a5 5 0 00-5 5v134L0 146.5h11.4v128.8a5 5 0 005 5h165.1a5 5 0 005-5V5a5 5 0 00-5-5z'/%3E%3Cpath fill='rgba(0,0,0,0.23)' d='M16.4 1a4 4 0 00-4 4v134.5l-.5.3-8.6 5.7h9v129.8a4 4 0 004 4h165.2a4 4 0 004-4V5a4 4 0 00-4-4H16.4m0-1h165.1a5 5 0 015 5v270.3a5 5 0 01-5 5H16.4a5 5 0 01-5-5V146.5H0l11.4-7.5V5a5 5 0 015-5z'/%3E%3C/svg%3E");
    border-image-slice: 12 12 12 17 fill;
    border-image-width: 12px 12px 12px 17px;
    border-image-repeat: repeat;
  }
  .results-right .bubble {
    justify-self: end;
  }
  .results-right .bubble::before {
    transform: scaleX(-1);
  }

  .bubble-inner {
    display: grid;
    grid-template-columns: [size-info] 1fr [percent-info] auto;
    position: relative;
    --main-padding: 1px;
    --speech-padding: 2.1rem;
    padding: var(--main-padding) var(--main-padding) var(--main-padding)
      var(--speech-padding);
    gap: 0.9rem;
  }
  .results-right .bubble-inner {
    padding: var(--main-padding) var(--speech-padding) var(--main-padding)
      var(--main-padding);
    grid-template-columns: [percent-info] auto [size-info] 1fr;
  }

  .unit {
    color: var(--main-theme-color);
  }
  .type-label {
    display: none;
  }

  .size-info {
    align-self: center;
    justify-self: start;
    grid-column: size-info;
    grid-row: 1;
  }
  .file-size {
    white-space: nowrap;
  }

  .percent-info {
    align-self: center;
    display: grid;
    --arrow-width: 16px;
    grid-template-columns: [arrow] var(--arrow-width) [data] auto;
    grid-column: percent-info;
    grid-row: 1;
    --shadow-direction: -1px;
    filter: drop-shadow(var(--shadow-direction) 0 0 rgba(0, 0, 0, 0.67));
  }
  .results-right .percent-info {
    grid-template-columns: [data] auto [arrow] var(--arrow-width);
    --shadow-direction: 1px;
  }

  .big-arrow {
    display: block;
    width: 100%;
    fill: var(--main-theme-color);
    grid-column: arrow;
    grid-row: 1;
    align-self: stretch;
  }
  .results-right .big-arrow {
    transform: scaleX(-1);
  }

  .percent-output {
    grid-column: data;
    grid-row: 1;
    display: grid;
    grid-template-columns: auto auto auto;
    line-height: 1;
    background: var(--main-theme-color);
    --radius: 4px;
    border-radius: 0 var(--radius) var(--radius) 0;
    --padding-arrow-side: 0.6rem;
    --padding-other-side: 1.1rem;
    padding: 0.7rem var(--padding-other-side);
    padding-left: var(--padding-arrow-side);
    /* Squoosh's percent number is always white, on both the pink and blue
       badges (not the panel's header-text colour, which is dark on blue). */
    color: var(--white);
  }
  .results-right .percent-output {
    border-radius: var(--radius) 0 0 var(--radius);
    padding-left: var(--padding-other-side);
    padding-right: var(--padding-arrow-side);
  }

  .size-direction {
    font-weight: 700;
    align-self: center;
    font-family: sans-serif;
    opacity: 0.76;
    text-shadow: 0 2px rgba(0, 0, 0, 0.3);
    font-size: 1.5rem;
    position: relative;
    top: 3px;
  }
  .size-value {
    font-family: 'Roboto Mono Numbers';
    font-size: 2.6rem;
    text-shadow: 0 2px rgba(0, 0, 0, 0.3);
  }
  .percent-char {
    align-self: start;
    position: relative;
    top: 4px;
    opacity: 0.76;
    margin-left: 0.2rem;
  }

  .download {
    --size: 63px;
    width: calc(var(--size) + var(--download-overflow-size));
    height: calc(var(--size) + var(--download-overflow-size));
    position: relative;
    grid-row: 1;
    grid-column: download;
    margin: calc(var(--download-overflow-size) / -2) 0;
    margin-right: calc(var(--download-overflow-size) / -3);
    display: grid;
    align-items: center;
    justify-items: center;
    align-self: center;
  }
  .results-right .download {
    margin-left: calc(var(--download-overflow-size) / -3);
    margin-right: 0;
  }

  .download-blobs {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .download-blobs path {
    fill: var(--hot-theme-color);
    opacity: 0.7;
  }

  .download-icon {
    grid-area: 1 / 1;
  }
  .download-icon svg {
    --size: 27px;
    width: var(--size);
    height: var(--size);
    fill: var(--white);
    position: relative;
    top: 2px;
    left: 2px;
    animation: action-enter 0.2s;
  }

  @keyframes action-enter {
    from {
      transform: rotate(-90deg);
      opacity: 0;
      animation-timing-function: ease-out;
    }
  }
  @keyframes action-leave {
    from {
      transform: rotate(0deg);
      opacity: 1;
      animation-timing-function: ease-out;
    }
  }

  .download-disable {
    pointer-events: none;
  }
  .download-disable .download-icon svg {
    opacity: 0;
    transform: rotate(90deg);
    animation: action-leave 0.2s;
  }

  .is-original .big-arrow {
    fill: transparent;
  }
  .is-original .percent-output {
    background: none;
    color: var(--white);
  }
  .is-original .download-blobs path {
    fill: var(--black);
  }
  .is-original .unit {
    color: var(--white);
    opacity: 0.76;
  }

  .spinner {
    grid-area: 1 / 1;
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    position: relative;
    z-index: 1;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .results {
      --download-overflow-size: 18px;
    }

    .bubble-inner {
      --speech-padding: 1.2rem;
      gap: 0.35rem;
    }

    .file-size {
      font-size: 0.82rem;
    }

    .type-label {
      display: inline;
      color: var(--less-light-gray);
    }

    .percent-info {
      --arrow-width: 9px;
    }

    .percent-output {
      --padding-arrow-side: 0.35rem;
      --padding-other-side: 0.55rem;
      padding-top: 0.45rem;
      padding-bottom: 0.45rem;
    }

    .size-direction {
      font-size: 1rem;
      top: 1px;
    }

    .size-value {
      font-size: 1.55rem;
    }

    .percent-char {
      top: 2px;
      margin-left: 0.1rem;
      font-size: 0.75rem;
    }

    .download {
      --size: 48px;
    }

    .download-icon svg {
      --size: 22px;
    }
  }
</style>
