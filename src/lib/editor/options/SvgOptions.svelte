<script lang="ts">
  import type { SvgOptimizeOptions } from '$lib/svg/optimize-options';
  import { describeWinner } from '$lib/svg/svgo-config';
  import AdvancedSection from './AdvancedSection.svelte';
  import Checkbox from './Checkbox.svelte';
  import OptionRow from './OptionRow.svelte';
  import Range from './Range.svelte';
  import Select from './Select.svelte';
  import ToggleRow from './ToggleRow.svelte';

  interface Props {
    options: SvgOptimizeOptions;
    winner?: string;
  }

  let { options, winner }: Props = $props();
</script>

<form class="options-section" onsubmit={(event) => event.preventDefault()}>
  <label class="option-text-first">
    Mode:
    <Select bind:value={options.mode}>
      <option value="auto">Auto</option>
      <option value="manual">Manual</option>
    </Select>
  </label>

  {#if options.mode === 'auto'}
    <p class="option-hint">
      Tries several settings and keeps the smallest result that renders
      identically.
    </p>
    {#if winner}
      <p class="auto-winner">Auto: {describeWinner(winner)}</p>
    {/if}
  {:else}
    <OptionRow>
      <Range min={0} max={4} step={1} bind:value={options.precision}
        >Precision:</Range
      >
    </OptionRow>
    <AdvancedSection>
      <ToggleRow label="Multipass">
        <Checkbox bind:checked={options.multipass} />
      </ToggleRow>
      <ToggleRow label="Keep title & description">
        <Checkbox bind:checked={options.keepTitleDesc} />
      </ToggleRow>
      <ToggleRow label="Reuse identical paths">
        <Checkbox bind:checked={options.reusePaths} />
      </ToggleRow>
      <ToggleRow label="Convert styles to attributes">
        <Checkbox bind:checked={options.convertStyleToAttrs} />
      </ToggleRow>
      <ToggleRow label="Remove off-canvas paths">
        <Checkbox bind:checked={options.removeOffCanvasPaths} />
      </ToggleRow>
      <ToggleRow label="Remove width/height">
        <Checkbox bind:checked={options.removeDimensions} />
      </ToggleRow>
      <p class="option-hint">Verify the preview after enabling these.</p>
    </AdvancedSection>
  {/if}
</form>

<style>
  .option-hint {
    margin: 4px var(--horizontal-padding) 10px;
    color: var(--text-3);
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .auto-winner {
    margin: -4px var(--horizontal-padding) 10px;
    color: var(--text-3);
    font-size: 0.85rem;
    line-height: 1.4;
  }
</style>
