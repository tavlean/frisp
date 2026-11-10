<script lang="ts">
  // Single-column option row — the `option-one-cell` grid wrapper (layout lives
  // in theme.css) that every Range sits in. Extracted to replace the wrapper
  // `<div class="option-one-cell">` repeated across the encoder panels.
  // `slide` plays the same 300ms reveal the panels use for rows that
  // appear/disappear behind a toggle. One element, not an `{#if slide}` pair:
  // a local transition plays only when its own block is created, so the
  // element must belong to the caller's `{#if}`.
  import type { Snippet } from 'svelte';
  import { reveal } from '../motion';

  let {
    slide: animate = false,
    children,
  }: { slide?: boolean; children: Snippet } = $props();
</script>

<div class="option-one-cell" transition:reveal={{ enabled: animate }}>
  {@render children()}
</div>
