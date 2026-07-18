<script lang="ts">
  // A porcelain rail button cycling the hybrid's color-scheme: System → Light →
  // Dark → System. The parent owns the `mode` state (so it can set .force-light
  // / .force-dark on the root); this button shows the CURRENT MODE's glyph
  // (sun-moon = system, sun = light, moon = dark) and captions the mode in its
  // (near-black) tooltip + aria-label. The `.hy-rail-btn` porcelain skin (surface
  // + right-anchored tooltip) lives in hybrid.css so the rail's buttons and this
  // one share one definition.
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import sunMoonIcon from '$lib/lab/icons/sun-moon.svg?raw';
  import sunIcon from '$lib/lab/icons/sun.svg?raw';
  import moonIcon from '$lib/lab/icons/moon.svg?raw';

  export type ThemeMode = 'system' | 'light' | 'dark';

  interface Props {
    mode: ThemeMode;
    /** The resolved appearance (system resolves via matchMedia in the parent). */
    resolved: 'light' | 'dark';
    onCycle: () => void;
  }

  let { mode, resolved, onCycle }: Props = $props();

  const glyph = $derived(
    mode === 'system' ? sunMoonIcon : mode === 'light' ? sunIcon : moonIcon,
  );
  const caption = $derived(
    mode === 'system'
      ? `Theme: System (${resolved})`
      : mode === 'light'
        ? 'Theme: Light'
        : 'Theme: Dark',
  );
</script>

<button
  type="button"
  class="hy-rail-btn"
  data-tooltip={caption}
  aria-label={caption}
  onclick={() => onCycle()}
>
  <LabIcon svg={glyph} size={18} />
</button>
