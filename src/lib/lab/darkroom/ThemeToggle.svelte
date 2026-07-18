<script lang="ts">
  // A rail button cycling the darkroom's color-scheme: System → Light → Dark →
  // System. The parent owns the `mode` state (so it can set .force-light /
  // .force-dark on the root); the glyph shows the CURRENT mode (sun-moon =
  // follow system, sun = light, moon = dark) and the mode is named in the
  // aria-label + tooltip.
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

  const icon = $derived(
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
  class="dr-rail-btn dr-theme-toggle"
  data-tooltip={caption}
  aria-label={caption}
  onclick={() => onCycle()}
>
  <LabIcon svg={icon} size={18} />
</button>
