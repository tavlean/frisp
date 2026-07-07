<script lang="ts">
  // A porcelain rail button cycling the hybrid's color-scheme: System → Light →
  // Dark → System. The parent owns the `mode` state (so it can set .force-light
  // / .force-dark on the root); this button renders the sun/moon glyph for the
  // effective appearance and captions the current mode in its (near-black)
  // tooltip. The `.hy-rail-btn` porcelain skin (surface + right-anchored tooltip)
  // lives in hybrid.css so the rail's buttons and this one share one definition.
  export type ThemeMode = 'system' | 'light' | 'dark';

  interface Props {
    mode: ThemeMode;
    /** The resolved appearance (system resolves via matchMedia in the parent). */
    resolved: 'light' | 'dark';
    onCycle: () => void;
  }

  let { mode, resolved, onCycle }: Props = $props();

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
  {#if mode === 'system'}
    <!-- Half sun / half moon to signal "follow system". -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path d="M12 7A5 5 0 0 1 12 17Z" fill="currentColor" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        opacity="0.55"
      />
    </svg>
  {:else if resolved === 'dark'}
    <!-- Moon. -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  {:else}
    <!-- Sun. -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4.2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  {/if}
</button>
