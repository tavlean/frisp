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
    Method:
    <Select
      value={options.method}
      onchange={(v) => (options.method = v as ResizeMethod)}
    >
      {#if isVector}
        <option value="vector">Vector</option>
      {/if}
      <option value="lanczos3">Lanczos3</option>
      <option value="mitchell">Mitchell</option>
      <option value="catrom">Catmull-Rom</option>
      <option value="triangle">Triangle (bilinear)</option>
      <option value="hqx">hqx (pixel art)</option>
      <option value="browser-pixelated">Browser pixelated</option>
      <option value="browser-low">Browser low quality</option>
      <option value="browser-medium">Browser medium quality</option>
      <option value="browser-high">Browser high quality</option>
    </Select>
  </label>
  <label class="option-text-first">
    Preset:
    <Select value={String(preset)} onchange={onPreset}>
      {#each sizePresets as p (p)}
        <option value={String(p)}>{Math.round(p * 100)}%</option>
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
  {#if isWorker}
    <div transition:slide={{ duration: 300 }}>
      <label class="option-toggle">
        Premultiply alpha channel
        <Checkbox bind:checked={options.premultiply} />
      </label>
      <label class="option-toggle">
        Linear RGB
        <Checkbox bind:checked={options.linearRGB} />
      </label>
    </div>
  {/if}
  <label class="option-toggle">
    Maintain aspect ratio
    <Checkbox checked={maintainAspect} onchange={setMaintainAspect} />
  </label>
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
</form>
