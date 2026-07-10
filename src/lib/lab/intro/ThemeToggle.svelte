<script lang="ts">
  // Inline System → Light → Dark cycler for the intro-lab variants' headers.
  // Unlike the editor labs' fixed-corner segmented pill, this is a single
  // compact button a variant places INSIDE its own header layout. It only
  // reports the mode up; the page toggles force-light/force-dark on its
  // .intro-lab-root, and light-dark() does the rest.

  export type ThemeMode = 'system' | 'light' | 'dark';

  interface Props {
    value: ThemeMode;
    onchange: (mode: ThemeMode) => void;
  }

  let { value, onchange }: Props = $props();

  const next: Record<ThemeMode, ThemeMode> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };
  const label = $derived(
    value === 'system' ? 'Auto' : value === 'light' ? 'Light' : 'Dark',
  );
</script>

<button
  type="button"
  class="theme-toggle"
  title="Theme: {label} — click to change"
  aria-label="Theme: {label} — click to change"
  onclick={() => onchange(next[value])}
>
  {#if value === 'light'}
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2" />
        <path
          d="M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"
        />
      </g>
    </svg>
  {:else if value === 'dark'}
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z"
        fill="currentColor"
      />
    </svg>
  {:else}
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--il-border);
    border-radius: 10px;
    background: transparent;
    color: var(--il-text-2);
    cursor: pointer;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      background-color 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .theme-toggle {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .theme-toggle:hover {
    color: var(--il-text-1);
    border-color: var(--il-border-strong);
    background: var(--il-surface);
  }
  .theme-toggle svg {
    width: 17px;
    height: 17px;
    display: block;
  }
</style>
