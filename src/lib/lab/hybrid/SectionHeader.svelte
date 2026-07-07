<script lang="ts">
  // A collapsible section header for the hybrid Inspector: a chevron + label on
  // the left, and on the right an optional EYE enable-toggle (the REAL per-section
  // enable — Resize / Reduce-palette). The eye maps a reference tool's per-section
  // visibility control onto Frisp's real enable state. A disabled section reads
  // dimmed. Porcelain skin: sentence-case 13px semibold label, thin-stroke glyphs,
  // inset hover on the eye. Caller owns `open` (local UI) and `enabled` (real).
  interface Props {
    label: string;
    /** When defined, the eye enable-toggle is bound to this side's state. */
    enabled?: boolean;
    /** When true the eye is shown (Resize/Palette); false → header only. */
    hasEnable?: boolean;
    open?: boolean;
    onToggleEnabled?: (next: boolean) => void;
    onToggleOpen?: () => void;
  }

  let {
    label,
    enabled = false,
    hasEnable = false,
    open = false,
    onToggleEnabled,
    onToggleOpen,
  }: Props = $props();
</script>

<div class="hy-section-header" class:dimmed={hasEnable && !enabled}>
  <button
    type="button"
    class="hy-section-label"
    aria-expanded={open}
    onclick={() => onToggleOpen?.()}
  >
    <span class="hy-chevron" class:open>
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M2 3.5L5 6.5L8 3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="hy-section-title">{label}</span>
  </button>

  {#if hasEnable}
    <button
      type="button"
      class="hy-eye"
      class:on={enabled}
      aria-pressed={enabled}
      data-tooltip={enabled
        ? 'Enabled — click to disable'
        : 'Disabled — click to enable'}
      aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
      onclick={() => onToggleEnabled?.(!enabled)}
    >
      {#if enabled}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="2.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 4L20 20M9.5 9.6A2.6 2.6 0 0 0 14.4 14.5M6.3 6.4C3.8 8 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.4-.3 3.5-.7M17.6 17.5C20.2 15.9 21.5 12 21.5 12S18 5.5 12 5.5c-.5 0-1 0-1.5.1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
    </button>
  {/if}
</div>

<style>
  .hy-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 8px 0 8px;
    transition: opacity 200ms ease;
  }
  .hy-section-header.dimmed {
    opacity: 0.55;
  }

  .hy-section-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 4px;
    margin: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--pc-text-1);
    font: inherit;
    text-align: left;
  }
  .hy-section-label:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
    border-radius: 8px;
  }

  /* Sentence-case, 13px semibold — porcelain type. */
  .hy-section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--pc-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hy-chevron {
    flex: none;
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    color: var(--pc-text-3);
    transform: rotate(-90deg);
    transition: transform 200ms ease;
  }
  .hy-chevron.open {
    transform: none;
  }
  .hy-chevron svg {
    width: 10px;
    height: 10px;
    display: block;
  }

  .hy-eye {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: none;
    cursor: pointer;
    color: var(--pc-text-3);
    transition:
      color 140ms ease,
      background-color 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-eye {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }
  .hy-eye:hover {
    color: var(--pc-text-1);
    background: var(--pc-inset);
  }
  .hy-eye.on {
    color: var(--pc-text-1);
  }
  .hy-eye svg {
    width: 17px;
    height: 17px;
    display: block;
  }
  .hy-eye:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* Near-black tooltip (below), consistent with the reference language. */
  .hy-eye[data-tooltip] {
    position: relative;
  }
  .hy-eye[data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    z-index: 40;
    right: 0;
    top: calc(100% + 8px);
    padding: 5px 9px;
    border-radius: 8px;
    background: var(--pc-tooltip-bg);
    color: var(--pc-tooltip-text);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    transition: opacity 130ms ease;
  }
  .hy-eye[data-tooltip]:hover::after,
  .hy-eye[data-tooltip]:focus-visible::after {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .hy-section-header,
    .hy-chevron,
    .hy-eye,
    .hy-eye[data-tooltip]::after {
      transition-duration: 0ms;
    }
  }
</style>
