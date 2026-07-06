import { defineConfig, devices } from '@playwright/test';

// E2E regression suite. Runs against the PRODUCTION static build served by
// `vite preview`, so it exercises the real emitted codec assets, the generated
// service worker, and the COOP/COEP cross-origin-isolation headers (which the
// `presk-cross-origin-isolation` plugin injects into preview too). This is the
// automated safety net for codec changes — run it after any codec/build change.
const PORT = 4317;
// PLAYWRIGHT_SKIP_BUILD=1 serves the existing build/ without rebuilding. Set
// it ONLY when a fresh build is guaranteed — `npm test` sets it because
// `check` just built. Never inferred from build/ merely existing: a stale dir
// would silently test old code.
const webServerCommand =
  process.env.PLAYWRIGHT_SKIP_BUILD === '1' && !process.env.CI
    ? `npm run preview -- --port ${PORT} --strictPort`
    : `npm run build && npm run preview -- --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  // WASM codec encodes (esp. webkit/JavaScriptCore compiling the codec module
  // on a cold first navigation) are heavy on shared CI runners; give the whole
  // test more headroom there than locally.
  timeout: process.env.CI ? 120_000 : 90_000,
  expect: { timeout: 20_000 },
  // Retry on CI only. These are real-browser WASM encodes on shared hardware:
  // an occasional cold-start stall or scheduler hiccup is environmental, not a
  // regression, and self-heals on a second attempt. A test that only passes on
  // retry is reported as "flaky" (visible signal) without failing the build; a
  // genuine break fails all 3 attempts. Locally, retries stay 0 so flakes surface.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    // WebKit = the engine Safari ships. The codecs are emscripten/wasm-bindgen
    // WASM, and Safari's JS/WASM engine (JavaScriptCore) differs from V8, so this
    // is the cross-engine guard for codec rebuilds. Run with `--project=webkit`.
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
