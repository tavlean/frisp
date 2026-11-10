<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { APP_NAME } from 'shared/brand';

  const notFound = $derived(page.status === 404);
  const heading = $derived(
    notFound ? 'Page not found' : 'Something went wrong',
  );
</script>

<svelte:head>
  <title>{heading} - {APP_NAME}</title>
</svelte:head>

<main class="error-page">
  <p class="brand">{APP_NAME}</p>
  <h1>{heading}</h1>
  {#if !notFound && page.error?.message}
    <p class="message">{page.error.message}</p>
  {/if}
  <!-- A full reload rather than a client navigation, so the app starts from
       a clean state after whatever failed. -->
  <a class="home" href={resolve('/')} data-sveltekit-reload>
    Back to {APP_NAME}
  </a>
</main>

<style>
  /* Palette and type follow the intro (src/lib/editor/intro/Intro.svelte). */
  .error-page {
    color-scheme: light dark;
    min-height: 100dvh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
    text-align: center;
    background: light-dark(#f4f3f1, #111113);
    color: light-dark(#1a1a1e, #f5f5f7);
  }
  .brand {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    /* The intro's --i-text-3, measured at AA (4.5:1) on this background. */
    color: light-dark(rgba(26, 26, 30, 0.64), rgba(245, 245, 247, 0.66));
  }
  h1 {
    margin: 0;
    font-size: 3rem;
    font-weight: 900;
    letter-spacing: -0.03em;
  }
  .message {
    margin: 0;
    max-width: 40rem;
    font-size: 1.5rem;
    color: light-dark(rgba(26, 26, 30, 0.7), rgba(245, 245, 247, 0.74));
  }
  .home {
    padding: 0.8rem 1.6rem;
    border: 1px solid
      light-dark(rgba(20, 20, 15, 0.09), rgba(255, 255, 255, 0.09));
    border-radius: 1rem;
    background: light-dark(#ffffff, #1c1c1f);
    color: inherit;
    font-size: 1.2rem;
    font-weight: 600;
    text-decoration: none;
  }
  .home:hover {
    border-color: light-dark(rgba(20, 20, 15, 0.16), rgba(255, 255, 255, 0.18));
  }
  .home:focus-visible {
    outline: 2px solid light-dark(#e4602f, #ff8a5e);
    outline-offset: 2px;
  }
</style>
