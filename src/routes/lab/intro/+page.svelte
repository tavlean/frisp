<script lang="ts">
  import { dev } from '$app/environment';
  import { resolve } from '$app/paths';

  const variants = [
    {
      name: 'billboard',
      href: resolve('/lab/intro/billboard'),
      tagline:
        'Giant two-tone headline over a small floating drop card — the page is a statement, the card is the door.',
    },
    {
      name: 'frame',
      href: resolve('/lab/intro/frame'),
      tagline:
        'The whole viewport is the drop zone — a permanent viewfinder frame with HUD micro-copy in the corners.',
    },
    {
      name: 'split',
      href: resolve('/lab/intro/split'),
      tagline:
        'Editorial split — oversized left-aligned headline and stats, tall drop panel with try-a-sample thumbs on the right.',
    },
    {
      name: 'ledger',
      href: resolve('/lab/intro/ledger'),
      tagline:
        'Hyper-minimal mono-accent — one hairline drop tray and a quiet ledger of what happens to your pixels.',
    },
  ] as const;
</script>

{#if dev}
  <main class="intro-index">
    <header>
      <p class="eyebrow">frisp lab</p>
      <h1>Intro page</h1>
      <p class="lede">
        Four takes on the landing screen — minimal full-viewport single section,
        real drop handling, light + dark. Pick by looking.
      </p>
    </header>
    <ul>
      {#each variants as v (v.name)}
        <li>
          <a href={v.href}>
            <span class="name">{v.name}</span>
            <span class="tagline">{v.tagline}</span>
          </a>
        </li>
      {/each}
    </ul>
    <footer>
      <a class="back" href={resolve('/lab')}>← all experiments</a>
    </footer>
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .intro-index {
    color-scheme: light dark;
    min-height: 100dvh;
    box-sizing: border-box;
    padding: clamp(24px, 6vw, 72px);
    background: light-dark(#f4f3f1, #111113);
    color: light-dark(#1a1a1e, #f5f5f7);
    font-size: 15px;
  }
  .eyebrow {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: light-dark(rgba(26, 26, 30, 0.4), rgba(245, 245, 247, 0.4));
  }
  h1 {
    margin: 6px 0 8px;
    font-size: clamp(28px, 5vw, 44px);
    letter-spacing: -0.02em;
  }
  .lede {
    margin: 0 0 34px;
    max-width: 52ch;
    color: light-dark(rgba(26, 26, 30, 0.62), rgba(245, 245, 247, 0.64));
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
    max-width: 720px;
  }
  a {
    display: grid;
    gap: 4px;
    padding: 18px 20px;
    border: 1px solid
      light-dark(rgba(20, 20, 15, 0.09), rgba(255, 255, 255, 0.09));
    border-radius: 14px;
    text-decoration: none;
    color: inherit;
    background: light-dark(#ffffff, #1c1c1f);
    transition:
      border-color 150ms ease,
      transform 150ms ease;
  }
  @supports (corner-shape: squircle) {
    a {
      corner-shape: squircle;
      border-radius: 18px;
    }
  }
  a:hover {
    border-color: light-dark(rgba(20, 20, 15, 0.2), rgba(255, 255, 255, 0.22));
    transform: translateY(-1px);
  }
  .name {
    font-weight: 750;
    letter-spacing: 0.01em;
  }
  .tagline {
    color: light-dark(rgba(26, 26, 30, 0.62), rgba(245, 245, 247, 0.64));
  }
  footer {
    margin-top: 36px;
  }
  .back {
    display: inline-block;
    padding: 8px 0;
    border: none;
    background: none;
    color: light-dark(#2276c9, #53b2ff);
  }
</style>
