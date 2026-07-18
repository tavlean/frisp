<script lang="ts">
  // The left icon rail: bare chips on the page background. Top: a Back chip
  // (hidden with no file). Middle: the two flyout openers (Image info, Compare) —
  // an open flyout's button reads as an active chip. Bottom: rotate + the theme
  // toggle. The parent owns which flyout is open and the theme state; the rail
  // just renders buttons and forwards intents, binding the two opener buttons so
  // the flyouts can anchor near them and restore focus on close.
  import ThemeToggle, { type ThemeMode } from './ThemeToggle.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import backIcon from '$lib/lab/icons/back.svg?raw';
  import infoIcon from '$lib/lab/icons/info.svg?raw';
  import compareIcon from '$lib/lab/icons/compare.svg?raw';
  import rotateIcon from '$lib/lab/icons/rotate.svg?raw';

  type Flyout = 'info' | 'compare' | null;

  interface Props {
    hasFile: boolean;
    openFlyout: Flyout;
    themeMode: ThemeMode;
    themeResolved: 'light' | 'dark';
    infoBtn?: HTMLButtonElement;
    compareBtn?: HTMLButtonElement;
    onBack: () => void;
    onToggleFlyout: (which: 'info' | 'compare') => void;
    onRotate: () => void;
    onCycleTheme: () => void;
  }

  let {
    hasFile,
    openFlyout,
    themeMode,
    themeResolved,
    infoBtn = $bindable(),
    compareBtn = $bindable(),
    onBack,
    onToggleFlyout,
    onRotate,
    onCycleTheme,
  }: Props = $props();
</script>

<nav class="dr-rail" aria-label="Tools">
  <div class="dr-rail-group">
    {#if hasFile}
      <button
        type="button"
        class="dr-rail-btn"
        data-tooltip="Back"
        aria-label="Back"
        onclick={() => onBack()}
      >
        <LabIcon svg={backIcon} size={18} />
      </button>
    {/if}
  </div>

  <div class="dr-rail-group">
    <button
      type="button"
      class="dr-rail-btn"
      class:active={openFlyout === 'info'}
      data-tooltip="Image info"
      aria-label="Image info"
      aria-pressed={openFlyout === 'info'}
      bind:this={infoBtn}
      onclick={() => onToggleFlyout('info')}
    >
      <LabIcon svg={infoIcon} size={18} />
    </button>

    <button
      type="button"
      class="dr-rail-btn"
      class:active={openFlyout === 'compare'}
      data-tooltip="Compare"
      aria-label="Compare"
      aria-pressed={openFlyout === 'compare'}
      bind:this={compareBtn}
      onclick={() => onToggleFlyout('compare')}
    >
      <LabIcon svg={compareIcon} size={18} />
    </button>
  </div>

  <div class="dr-rail-group dr-rail-bottom">
    <button
      type="button"
      class="dr-rail-btn"
      data-tooltip="Rotate"
      aria-label="Rotate"
      onclick={() => onRotate()}
    >
      <LabIcon svg={rotateIcon} size={18} />
    </button>

    <ThemeToggle
      mode={themeMode}
      resolved={themeResolved}
      onCycle={onCycleTheme}
    />
  </div>
</nav>

<style>
  .dr-rail {
    position: fixed;
    top: 68px;
    left: 12px;
    bottom: 76px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dr-rail-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dr-rail-bottom {
    margin-top: auto;
  }
</style>
