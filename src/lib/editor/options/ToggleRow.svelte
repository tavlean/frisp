<script lang="ts">
  // Label + control row — the `option-toggle` grid wrapper (text on the left,
  // a Checkbox/Toggle on the right; layout in theme.css). Extracted to replace
  // the `<label class="option-toggle">…</label>` wrapper repeated across the
  // panels. `class` adds the gray "section-enabler" variant; `slide` plays the
  // 300ms reveal for rows that appear/disappear behind another toggle. One
  // element, not an `{#if slide}` pair: a local transition plays only when its
  // own block is created, so the element must belong to the caller's `{#if}`.
  import type { Snippet } from 'svelte';
  import { reveal } from '../motion';

  let {
    label,
    class: extraClass = '',
    slide: animate = false,
    children,
  }: {
    label: string;
    class?: string;
    slide?: boolean;
    children: Snippet;
  } = $props();
</script>

<label
  class={['option-toggle', extraClass]}
  transition:reveal={{ enabled: animate }}
>
  {label}
  {@render children()}
</label>
