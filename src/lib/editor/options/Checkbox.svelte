<script lang="ts">
  // A real (hidden) checkbox drives a rendered box: rounded square that fills
  // with the side accent and draws a check when on, with a focus ripple.
  interface Props {
    checked?: boolean;
    disabled?: boolean;
    name?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    name,
    onchange,
  }: Props = $props();
</script>

<div class="checkbox">
  <span class={['box', { checked, disabled }]} aria-hidden="true">
    <svg class="tick" viewBox="0 0 12 10">
      <path
        d="M1 5.5L4.5 9L11 1.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
  <input
    class="real-checkbox"
    type="checkbox"
    {name}
    {disabled}
    bind:checked
    onchange={(e) => onchange?.(e.currentTarget.checked)}
  />
</div>

<style>
  .checkbox {
    display: inline-block;
    position: relative;
    --size: 17px;
  }

  .checkbox::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 200%;
    height: 200%;
    background-color: var(--main-theme-color);
    border-radius: 999px;
    opacity: 0.25;
    transform: translate(-50%, -50%) scale(0);
    transition-property: transform;
    transition-duration: 250ms;
  }

  .checkbox:focus-within::before {
    transform: translate(-50%, -50%) scale(1);
  }

  .real-checkbox {
    top: 0;
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .box {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--size);
    height: var(--size);
    box-sizing: border-box;
    border-radius: 5px;
    border: 1.5px solid rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.25);
    color: #16161c;
    transition:
      background-color 200ms ease,
      border-color 200ms ease,
      box-shadow 200ms ease;
  }

  .box.checked {
    background: linear-gradient(
      135deg,
      var(--main-theme-color),
      var(--hot-theme-color)
    );
    border-color: transparent;
    box-shadow: 0 0 10px var(--main-theme-glow, transparent);
  }

  .box.disabled {
    opacity: 0.45;
  }

  .tick {
    width: 10px;
    height: 9px;
    stroke-dasharray: 16;
    stroke-dashoffset: 16;
    transition: stroke-dashoffset 220ms ease 60ms;
  }

  .box.checked .tick {
    stroke-dashoffset: 0;
  }
</style>
