<script lang="ts">
  // A collapsible section header row for the darkroom Inspector: a label on the
  // left, and on the right an optional "eye" enable toggle plus a chevron that
  // expands/collapses the section body. The eye maps the reference tool's
  // per-section visibility control onto Frisp's real per-section ENABLE state
  // (Resize / Reduce-palette). A disabled section reads dimmed; the caller keeps
  // `open` and `enabled` as bindable local/real state respectively.
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import chevronDownIcon from '$lib/lab/icons/chevron-down.svg?raw';
  import eyeIcon from '$lib/lab/icons/eye.svg?raw';
  import eyeOffIcon from '$lib/lab/icons/eye-off.svg?raw';

  interface Props {
    label: string;
    /** When defined, renders the eye enable-toggle bound to this side's state. */
    enabled?: boolean;
    /** When true, the eye is shown (Resize/Palette); false → header only. */
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

<div class="dr-section-header" class:dimmed={hasEnable && !enabled}>
  <button
    type="button"
    class="dr-section-label"
    aria-expanded={open}
    onclick={() => onToggleOpen?.()}
  >
    <span class="dr-chevron" class:open>
      <LabIcon svg={chevronDownIcon} size={12} />
    </span>
    <span class="dr-section-title">{label}</span>
  </button>

  {#if hasEnable}
    <button
      type="button"
      class="dr-eye"
      class:on={enabled}
      aria-pressed={enabled}
      data-tooltip={enabled
        ? 'Enabled — click to disable'
        : 'Disabled — click to enable'}
      aria-label={enabled ? `Disable ${label}` : `Enable ${label}`}
      onclick={() => onToggleEnabled?.(!enabled)}
    >
      {#if enabled}
        <LabIcon svg={eyeIcon} size={17} />
      {:else}
        <LabIcon svg={eyeOffIcon} size={17} />
      {/if}
    </button>
  {/if}
</div>

<style>
  .dr-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 4px 0 6px;
    transition: opacity 200ms ease;
  }

  .dr-section-header.dimmed {
    opacity: 0.55;
  }

  .dr-section-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 4px;
    margin: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--dr-text-1);
    font: inherit;
    text-align: left;
  }

  .dr-section-title {
    font-size: 1rem;
    font-weight: 500;
    color: var(--dr-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dr-chevron {
    flex: none;
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    color: var(--dr-text-2);
    transform: rotate(-90deg);
    transition: transform 200ms ease;
  }
  .dr-chevron.open {
    transform: none;
  }

  .dr-eye {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: none;
    cursor: pointer;
    color: var(--dr-text-3);
    transition:
      color 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .dr-eye:hover {
    color: var(--dr-text-1);
    background: var(--dr-chip);
    border-color: var(--dr-border);
  }
  .dr-eye.on {
    color: var(--dr-text-1);
  }
  .dr-eye:focus-visible {
    outline: 2px solid var(--dr-focus);
    outline-offset: 2px;
  }
</style>
