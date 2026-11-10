<script lang="ts">
  // Ported from src/features/encoders/oxiPNG/client/index.tsx at parity.
  import type { EncodeOptions } from '#features/encoders/oxiPNG/shared/meta.ts';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import OptionRow from './OptionRow.svelte';
  import ToggleRow from './ToggleRow.svelte';

  let { options }: { options: EncodeOptions } = $props();
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <OptionRow>
    <Range min={0} max={6} step={1} bind:value={options.level}>Effort:</Range>
  </OptionRow>
  <ToggleRow label="Interlace">
    <Checkbox bind:checked={options.interlace} />
  </ToggleRow>
</form>
