<script lang="ts">
  // The Auto row every lossy encoder panel offers under its Quality slider:
  // a one-shot target select that swaps for a busy row with Cancel while the
  // search runs. The panel decides where it appears (never in a lossless or
  // transcode mode, where quality means nothing to search); EditorSession owns
  // the search and writes the winner back into the panel's options.
  import Select from './Select.svelte';
  import {
    AUTO_QUALITY_LABELS,
    type AutoQualityControl,
    type AutoQualityTarget,
  } from '../auto-quality';

  let { control }: { control: AutoQualityControl } = $props();

  const targets = Object.entries(AUTO_QUALITY_LABELS) as [
    AutoQualityTarget,
    string,
  ][];

  // Choosing a target swaps the select for the busy row. Focus moves to
  // Cancel only when the choice came from the select, so a keyboard user
  // stays on a live control instead of falling back to the page body.
  let focusCancel = false;
  function claimFocus(button: HTMLButtonElement) {
    if (!focusCancel) return;
    focusCancel = false;
    button.focus();
  }

  function run(value: string) {
    if (!(value in AUTO_QUALITY_LABELS)) return;
    focusCancel = true;
    control.run(value as AutoQualityTarget);
  }
</script>

{#if control.running}
  <div class="option-text-first auto-busy">
    <span role="status">Finding quality…</span>
    <button
      type="button"
      class="auto-cancel"
      {@attach claimFocus}
      onclick={control.cancel}>Cancel</button
    >
  </div>
{:else}
  <!-- One-shot: the select runs on choose and always shows its placeholder,
       since the result lands on the Quality slider. -->
  <label class="option-text-first">
    Auto:
    <Select action value="" onchange={run}>
      <option value="" disabled>Pick a target</option>
      {#each targets as [target, label] (target)}
        <option value={target}>{label}</option>
      {/each}
    </Select>
  </label>
{/if}

<style>
  /* Doubled class: theme.css sets option-text-first's columns under
     .editor-root, which would otherwise tie this rule. */
  .option-text-first.auto-busy {
    grid-template-columns: 1fr auto;
  }

  .auto-cancel {
    font: inherit;
    color: var(--text-1, #fff);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 150ms ease;
  }

  .auto-cancel:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  .auto-cancel:focus-visible {
    outline: none;
    border-color: var(--main-theme-color);
  }
</style>
