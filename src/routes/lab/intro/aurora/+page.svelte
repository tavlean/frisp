<script lang="ts">
  // Dev-only LAB exhibit: "aurora" — the retired production landing (a soft
  // coral blob field around a central drop disc), preserved verbatim as
  // AuroraIntro at the moment "frame" was promoted to live, so the lab keeps a
  // faithful before/after reference. Drops/picks are REAL via IntroDropDemo;
  // only the editor handoff is stubbed. AuroraIntro themes itself off the OS
  // (prefers-color-scheme), so — unlike the token-based variants — this page
  // has no theme toggle. Guarded on `dev`; +page.ts opts out of prerender/SSR.
  import { dev } from '$app/env';
  import { IntroDropDemo } from '#lib/lab/intro/drop-demo.svelte.ts';
  import AuroraIntro from '#lib/lab/intro/AuroraIntro.svelte';
  import '#lib/lab/intro/intro-lab.css';

  const demo = new IntroDropDemo();
  const shownFiles = $derived(demo.files.slice(0, 4));
</script>

{#if dev}
  <main class="intro-lab-root il-aurora-root" {@attach demo.dropTarget()}>
    {#if demo.hasFiles}
      <div class="accepted">
        <p class="summary">{demo.summary}</p>
        <ul class="filelist">
          {#each shownFiles as item (item.file.name)}
            <li>{item.file.name}</li>
          {/each}
        </ul>
        <button type="button" class="pill" onclick={() => demo.reset()}>
          Start over
        </button>
        <p class="stub">Lab stub — production opens the editor here.</p>
      </div>
    {:else}
      <AuroraIntro onFiles={(f) => demo.accept(f)} onMessage={() => {}} />
    {/if}
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .il-aurora-root {
    position: relative;
    min-height: 100dvh;
  }
  /* The accepted stub sits on the lab page's own neutral surface — AuroraIntro,
     which paints the full-screen blob field, is unmounted in this state. */
  .accepted {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    padding: 24px;
  }
  .summary {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--il-text-1);
  }
  .filelist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 40ch;
  }
  .filelist li {
    font-size: 13px;
    color: var(--il-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pill {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border: 1px solid var(--il-border);
    border-radius: 12px;
    background: var(--il-surface);
    box-shadow: var(--il-shadow-control);
    color: var(--il-text-1);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 150ms ease;
  }
  .pill:hover {
    border-color: var(--il-border-strong);
  }
  @supports (corner-shape: squircle) {
    .pill {
      corner-shape: squircle;
      border-radius: 15px;
    }
  }
  .stub {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--il-text-3);
  }
</style>
