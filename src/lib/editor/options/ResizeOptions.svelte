<script lang="ts">
  // Ported from src/features/processors/resize/client/index.tsx at parity.
  // Mutates the resize processor options in place (a shared $state proxy).
  import { slide } from 'svelte/transition';
  import {
    sizePresets,
    getResizePresetSize,
    getMatchingResizePreset,
  } from 'features/processors/resize/client/preset-state';
  import Select from './Select.svelte';
  import Checkbox from './Checkbox.svelte';
  import ToggleRow from './ToggleRow.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import type { ResizeOptionsState } from './processor-types';

  type ResizeMethod = ResizeOptionsState['method'];

  interface Props {
    options: ResizeOptionsState;
    inputWidth: number;
    inputHeight: number;
    /** When true (SVG source), offer the "Vector" rasterise-at-size method. */
    isVector?: boolean;
  }

  let { options, inputWidth, inputHeight, isVector = false }: Props = $props();

  let maintainAspect = $state(true);

  const workerMethods = ['triangle', 'catrom', 'mitchell', 'lanczos3', 'hqx'];
  const aspect = $derived(inputWidth / inputHeight || 1);
  const isWorker = $derived(workerMethods.includes(options.method));
  const preset = $derived(
    getMatchingResizePreset(
      { width: options.width, height: options.height },
      inputWidth,
      inputHeight,
    ),
  );

  function setWidth(w: number) {
    if (!Number.isFinite(w) || w < 1) return;
    options.width = w;
    if (maintainAspect) options.height = Math.round(w / aspect);
  }
  function setHeight(h: number) {
    if (!Number.isFinite(h) || h < 1) return;
    options.height = h;
    if (maintainAspect) options.width = Math.round(h * aspect);
  }
  function onPreset(value: string) {
    if (value === 'custom') return;
    const size = getResizePresetSize(inputWidth, inputHeight, Number(value));
    options.width = size.width;
    options.height = size.height;
  }
  function setMaintainAspect(value: boolean) {
    maintainAspect = value;
    if (value) options.height = Math.round(options.width / aspect);
  }
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <label class="option-text-first">
    Preset:
    <Select value={String(preset)} onchange={onPreset}>
      {#each sizePresets as p (p)}
        <option value={String(p)}>{+(p * 100).toFixed(2)}%</option>
      {/each}
      <option value="custom">Custom</option>
    </Select>
  </label>
  <label class="option-text-first">
    Width:
    <input
      class="text-field"
      type="number"
      min="1"
      bind:value={() => options.width, (v) => setWidth(Number(v))}
    />
  </label>
  <label class="option-text-first">
    Height:
    <input
      class="text-field"
      type="number"
      min="1"
      bind:value={() => options.height, (v) => setHeight(Number(v))}
    />
  </label>
  <ToggleRow label="Maintain aspect ratio">
    <Checkbox checked={maintainAspect} onchange={setMaintainAspect} />
  </ToggleRow>
  {#if !maintainAspect}
    <label class="option-text-first" transition:slide={{ duration: 300 }}>
      Fit method:
      <Select
        value={options.fitMethod}
        onchange={(v) => (options.fitMethod = v as 'stretch' | 'contain')}
      >
        <option value="stretch">Stretch</option>
        <option value="contain">Contain</option>
      </Select>
    </label>
  {/if}
  <!-- Lanczos3 is the right default for ~every photo; the scaler choice (and
       its colour-space companions) is expert territory, so it folds away. -->
  <AdvancedSection>
    <label class="option-text-first">
      Method:
      <!-- Four distinct jobs: Lanczos3 (photos), Mitchell (graphics / less
           ringing), hqx (pixel-art upscale), Browser pixelated (nearest
           neighbour). Catmull-Rom and Triangle stay in the code path (catrom
           finishes an hqx pass) but aren't offered — Lanczos3 + Mitchell cover
           the useful sharpness range. The three browser quality levels were
           dropped: lower quality than the worker filters and inconsistent
           across machines. -->
      <Select
        value={options.method}
        onchange={(v) => (options.method = v as ResizeMethod)}
      >
        {#if isVector}
          <option value="vector">Vector</option>
        {/if}
        <option value="lanczos3">Lanczos3</option>
        <option value="mitchell">Mitchell</option>
        <option value="hqx">hqx (pixel art)</option>
        <option value="browser-pixelated">Browser pixelated</option>
      </Select>
    </label>
    {#if isWorker}
      <div transition:slide={{ duration: 300 }}>
        <ToggleRow label="Premultiply alpha channel">
          <Checkbox bind:checked={options.premultiply} />
        </ToggleRow>
        <ToggleRow label="Linear RGB">
          <Checkbox bind:checked={options.linearRGB} />
        </ToggleRow>
      </div>
    {/if}
  </AdvancedSection>
</form>
