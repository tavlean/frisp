<script lang="ts">
  // Dev-only lab chrome: one thin switcher bar over every experiment so skins
  // and intro variants are flipped in place instead of round-tripping through
  // the index. In production builds app-strip-dev-only-routes replaces this
  // layout with a bare pass-through, so none of it is emitted.
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import LabTabs, {
    LAB_TABS_HEIGHT,
    type LabTab,
  } from '#lib/lab/LabTabs.svelte';

  let { children }: { children: Snippet } = $props();

  const uiTabs: LabTab[] = [
    {
      label: 'porcelain',
      id: '/lab/porcelain',
      href: resolve('/lab/porcelain'),
    },
    { label: 'darkroom', id: '/lab/darkroom', href: resolve('/lab/darkroom') },
    { label: 'hybrid', id: '/lab/hybrid', href: resolve('/lab/hybrid') },
  ];

  const introTabs: LabTab[] = [
    {
      label: 'billboard',
      id: '/lab/intro/billboard',
      href: resolve('/lab/intro/billboard'),
    },
    {
      label: 'frame',
      id: '/lab/intro/frame',
      href: resolve('/lab/intro/frame'),
    },
    {
      label: 'split',
      id: '/lab/intro/split',
      href: resolve('/lab/intro/split'),
    },
    {
      label: 'ledger',
      id: '/lab/intro/ledger',
      href: resolve('/lab/intro/ledger'),
    },
    {
      label: 'prism',
      id: '/lab/intro/prism',
      href: resolve('/lab/intro/prism'),
    },
    {
      label: 'showcase',
      id: '/lab/intro/showcase',
      href: resolve('/lab/intro/showcase'),
    },
    {
      label: 'aurora',
      id: '/lab/intro/aurora',
      href: resolve('/lab/intro/aurora'),
    },
  ];

  const tabs = $derived(
    uiTabs.some((tab) => tab.id === page.route.id)
      ? uiTabs
      : page.route.id?.startsWith('/lab/intro/')
        ? introTabs
        : null,
  );
</script>

{#if tabs}
  <LabTabs {tabs} current={page.route.id ?? ''} />
  <!-- The transform makes this viewport the containing block for the skins'
       own `position: fixed` chrome, so a whole experiment shifts below the
       bar without any per-skin offset. -->
  <div class="lab-viewport" style:top="{LAB_TABS_HEIGHT}px">
    {@render children()}
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .lab-viewport {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: auto;
    transform: translateZ(0);
  }
</style>
