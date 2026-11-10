<script lang="ts">
  // Shared "Advanced" disclosure: a Revealer toggle that slides its children
  // in and out. Replaces the identical scaffold that was duplicated in the
  // AVIF / WebP / MozJPEG panels (each with its own `showAdvanced`).
  import type { Snippet } from 'svelte';
  import { reveal } from '../motion';
  import Revealer from './Revealer.svelte';

  let { children }: { children: Snippet } = $props();

  let open = $state(false);
</script>

<label class="option-reveal">
  <Revealer bind:checked={open} />
  Advanced
</label>
{#if open}
  <div transition:reveal>
    {@render children()}
  </div>
{/if}
