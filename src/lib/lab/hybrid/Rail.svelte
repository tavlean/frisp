<script lang="ts">
  // The left icon rail (darkroom IA): ONE raised white squircle panel — not bare
  // buttons — holding the tool column. Top: Back (clears the file). Middle: the
  // two flyout openers (Image info, Compare) — an open flyout's button reads as
  // an active chip. Bottom: Rotate + the ThemeToggle (System → Light → Dark).
  // The parent owns which flyout is open and the theme state; the rail renders
  // buttons and forwards intents, binding the two opener buttons so the flyouts
  // can anchor near them and restore focus on close. Porcelain skin: buttons use
  // the shared .hy-rail-btn class (defined in hybrid.css).
  import ThemeToggle, { type ThemeMode } from './ThemeToggle.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import backIcon from '$lib/lab/icons/back.svg?raw';
  import infoIcon from '$lib/lab/icons/info.svg?raw';
  import compareIcon from '$lib/lab/icons/compare.svg?raw';
  import rotateIcon from '$lib/lab/icons/rotate.svg?raw';

  type Flyout = 'info' | 'compare' | null;

  interface Props {
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

<nav class="hy-rail" aria-label="Tools">
  <div class="hy-rail-group">
    <button
      type="button"
      class="hy-rail-btn"
      data-tooltip="Back"
      aria-label="Back"
      onclick={() => onBack()}
    >
      <LabIcon svg={backIcon} size={18} />
    </button>
  </div>

  <span class="hy-rail-divider" aria-hidden="true"></span>

  <div class="hy-rail-group">
    <button
      type="button"
      class="hy-rail-btn"
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
      class="hy-rail-btn"
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

  <span class="hy-rail-divider" aria-hidden="true"></span>

  <div class="hy-rail-group">
    <button
      type="button"
      class="hy-rail-btn"
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
  /* The rail is one RAISED porcelain squircle panel (surface language, not bare
     buttons). It docks below the top bar and above the single bottom bar. */
  .hy-rail {
    position: fixed;
    top: calc(var(--hy-margin) + var(--hy-topbar-h) + 8px);
    left: var(--hy-margin);
    bottom: calc(var(--hy-margin) + var(--hy-bar-h) + 8px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: var(--pc-panel);
    border: 1px solid var(--pc-border);
    border-radius: 16px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .hy-rail {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .hy-rail-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* The last group (Rotate + Theme) sinks to the bottom of the panel. */
  .hy-rail-group:last-child {
    margin-top: auto;
  }

  .hy-rail-divider {
    flex: none;
    width: 20px;
    height: 1px;
    background: var(--pc-border);
  }
  /* The second divider sits directly above the bottom group; nudge it down with
     the group so it hugs Rotate/Theme rather than floating mid-rail. */
  .hy-rail-divider:last-of-type {
    margin-top: auto;
  }
  .hy-rail-divider:last-of-type + .hy-rail-group {
    margin-top: 0;
  }
</style>
