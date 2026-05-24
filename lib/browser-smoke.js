/**
 * Copyright 2026 Tavlean.
 * Licensed under the Apache License, Version 2.0.
 */
const { spawn } = require('child_process');
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const requestedPort = Number(process.env.PREVIEW_PORT || 0);
const sessionName = `sq${process.pid}`;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const error = new Error(
        `${command} ${args.join(' ')} failed with ${reason}`,
      );
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Unable to reserve a preview port'));
          return;
        }
        resolve(String(address.port));
      });
    });
  });
}

function waitForPreview(origin, timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function check() {
      const request = http.get(origin, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.on('error', retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview server did not respond at ${origin}`));
        return;
      }
      setTimeout(check, 250);
    }

    check();
  });
}

function startPreview(port) {
  return spawn(npmCommand, ['run', 'preview'], {
    cwd: repoRoot,
    env: { ...process.env, PREVIEW_PORT: port },
    stdio: 'inherit',
  });
}

function waitForPreviewOrExit(preview, origin) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onExit = (code, signal) => {
      if (settled) return;
      settled = true;
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const error = new Error(`Preview server exited with ${reason}`);
      error.previewExited = true;
      reject(error);
    };

    preview.once('exit', onExit);
    waitForPreview(origin).then(
      () => {
        if (settled) return;
        settled = true;
        preview.off('exit', onExit);
        resolve();
      },
      (error) => {
        if (settled) return;
        settled = true;
        preview.off('exit', onExit);
        reject(error);
      },
    );
  });
}

async function startPreviewWithRetries() {
  const maxAttempts = requestedPort ? 1 : 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const port = await findAvailablePort();
    const origin = `http://127.0.0.1:${port}`;
    const preview = startPreview(port);

    try {
      await waitForPreviewOrExit(preview, origin);
      return { origin, preview };
    } catch (error) {
      lastError = error;
      preview.kill('SIGTERM');
      if (!error.previewExited || attempt === maxAttempts) break;
    }
  }

  throw lastError || new Error('Preview server did not start');
}

async function runBrowserSmoke() {
  const sampleImage = path.join(
    repoRoot,
    'src',
    'static-build',
    'assets',
    'icon-large.png',
  );
  const smokeAssetDir = path.join(repoRoot, '.tmp', 'browser-smoke');
  const extensionlessSampleImage = path.join(smokeAssetDir, 'icon-large');

  if (!existsSync(sampleImage)) {
    throw new Error(`Missing smoke-test image: ${sampleImage}`);
  }
  mkdirSync(smokeAssetDir, { recursive: true });
  copyFileSync(sampleImage, extensionlessSampleImage);

  if (process.env.SKIP_BROWSER_SMOKE_BUILD !== '1') {
    await run(npmCommand, ['run', 'build']);
  }

  const { origin, preview } = await startPreviewWithRetries();

  try {
    await run('playwright-cli', ['-s', sessionName, 'open', origin], {
      capture: true,
    });

    const smokeCode = `
async page => {
  const consoleErrors = [];
  let allowOfflineResourceErrors = false;
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (
      allowOfflineResourceErrors &&
      text.includes('Failed to load resource: net::ERR_FAILED')
    ) {
      return;
    }
    consoleErrors.push(text);
  });

  const input = page.locator('input[type=file]').first();
  async function selectEncoderOutput(sideIndex, label) {
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('select')].filter(select =>
          [...select.options].some(option => option.text === 'WebP'),
        ).length >= 2,
      null,
      { timeout: 15000 },
    );
    await page.evaluate(
      ({ index, optionLabel }) => {
        const encoderSelects = [...document.querySelectorAll('select')].filter(
          select => [...select.options].some(option => option.text === 'WebP'),
        );
        const select = encoderSelects[index];
        if (!select) throw new Error(\`Missing encoder select \${index}\`);
        const option = [...select.options].find(
          item => item.text === optionLabel,
        );
        if (!option) throw new Error(\`Missing encoder option \${optionLabel}\`);
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { index: sideIndex, optionLabel: label },
    );
  }

  async function selectWebPOutput(expectedDownload) {
    await selectEncoderOutput(1, 'WebP');
    await page.waitForFunction(
      () => !document.title.startsWith('⏳'),
      null,
      { timeout: 30000 },
    );
    await page.waitForFunction(
      expected =>
        [...document.querySelectorAll('a[download], a[href^="blob:"]')].some(
          anchor =>
            anchor.getAttribute('download') === expected &&
            anchor.href.startsWith('blob:'),
        ),
      expectedDownload,
      { timeout: 30000 },
    );
  }

  async function getBlobDownloads() {
    return page
      .locator('a[download], a[href^=blob]')
      .evaluateAll(elements =>
        elements.map(anchor => ({
          href: anchor.href,
          download: anchor.getAttribute('download'),
        })),
      );
  }

  async function getBlobDownload(expectedDownload) {
    const downloads = await page
      .locator('a[download], a[href^=blob]')
      .evaluateAll(
        async (elements, expected) => {
          const anchor = elements
            .slice()
            .reverse()
            .find(
            element =>
              element.getAttribute('download') === expected &&
              element.href.startsWith('blob:'),
          );
          if (!anchor) return;
          const response = await fetch(anchor.href);
          const blob = await response.blob();
          const image = await createImageBitmap(blob);
          return {
            href: anchor.href,
            download: anchor.getAttribute('download'),
            size: blob.size,
            type: blob.type,
            width: image.width,
            height: image.height,
          };
        },
        expectedDownload,
      );

    if (!downloads) {
      throw new Error(\`Missing \${expectedDownload} blob download\`);
    }
    if (downloads.size <= 0) {
      throw new Error(\`Expected \${expectedDownload} blob to be non-empty\`);
    }
    return downloads;
  }

  async function getBlobDownloadDimensions(expectedDownload) {
    return page.locator('a[download], a[href^=blob]').evaluateAll(
      async (elements, expected) =>
        Promise.all(
          elements
            .filter(
              element =>
                element.getAttribute('download') === expected &&
                element.href.startsWith('blob:'),
            )
            .map(async element => {
              const response = await fetch(element.href);
              const blob = await response.blob();
              const image = await createImageBitmap(blob);
              return {
                href: element.href,
                size: blob.size,
                type: blob.type,
                width: image.width,
                height: image.height,
              };
            }),
        ),
      expectedDownload,
    );
  }

  async function getRightOutputLabel() {
    return page.evaluate(() => {
      const encoderSelects = [...document.querySelectorAll('select')].filter(
        select => [...select.options].some(option => option.text === 'WebP'),
      );
      const select = encoderSelects[1];
      return select && select.options[select.selectedIndex].text;
    });
  }

  async function waitForCurrentOutput(expectedDownload) {
    await page.waitForFunction(
      () => !document.title.startsWith('⏳'),
      null,
      { timeout: 30000 },
    );
    await page.waitForFunction(
      expected =>
        [...document.querySelectorAll('a[download], a[href^="blob:"]')].some(
          anchor =>
            anchor.getAttribute('download') === expected &&
            anchor.href.startsWith('blob:'),
        ),
      expectedDownload,
      { timeout: 30000 },
    );
  }

  async function waitForDownloadWidth(expectedDownload, expectedWidth) {
    await page.waitForFunction(
      async ({ download, width }) => {
        const anchor = [...document.querySelectorAll('a[download], a[href^="blob:"]')]
          .reverse()
          .find(
          element =>
            element.getAttribute('download') === download &&
            element.href.startsWith('blob:'),
        );
        if (!anchor) return false;

        const response = await fetch(anchor.href);
        const blob = await response.blob();
        const image = await createImageBitmap(blob);
        return image.width === width;
      },
      { download: expectedDownload, width: expectedWidth },
      { timeout: 30000 },
    );
  }

  async function setRightResizeWidth(width) {
    const resizeToggle = page
      .locator('label')
      .filter({ hasText: /^\\s*Resize\\s*$/ })
      .last();
    await resizeToggle.click();
    const widthInput = page.locator('input[name="width"]').last();
    await widthInput.waitFor({ state: 'attached', timeout: 10000 });
    await widthInput.fill(String(width));
    await widthInput.dispatchEvent('input', { bubbles: true });
    await page.waitForFunction(
      expected => [...document.querySelectorAll('input[name="width"]')].at(-1)?.value === expected,
      String(width),
      { timeout: 5000 },
    );
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => localStorage.clear());
  await input.waitFor({
    state: 'attached',
    timeout: 15000,
  });
  await input.setInputFiles(${JSON.stringify(sampleImage)});
  await page.waitForURL('**/editor', { timeout: 15000 });
  await page.waitForFunction(
    () => document.title.includes('icon-large.png'),
    null,
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => !document.title.startsWith('⏳'),
    null,
    { timeout: 30000 },
  );

  await selectWebPOutput('icon-large.webp');

  const selected = await getRightOutputLabel();
  const links = await getBlobDownloads();
  const webpDownload = links.find(
    link => link.download === 'icon-large.webp' && link.href.startsWith('blob:'),
  );
  const bodyText = await page.locator('body').innerText();

  if (selected !== 'WebP') throw new Error(\`Expected WebP output, got \${selected}\`);
  if (!webpDownload) {
    throw new Error(
      \`Missing icon-large.webp blob download. Links: \${JSON.stringify(links)}\`,
    );
  }
  if (!/(^|\\s)([0-9.]+\\s)?(B|kB|MB)(\\s|$)/.test(bodyText)) {
    throw new Error('Missing visible output size text');
  }
  const initialWebPBlob = await getBlobDownload('icon-large.webp');

  await setRightResizeWidth(64);
  await waitForCurrentOutput('icon-large.webp');
  await waitForDownloadWidth('icon-large.webp', 64);
  const resizedWebPBlobs = await getBlobDownloadDimensions('icon-large.webp');
  if (!resizedWebPBlobs.some(blob => blob.width === 64)) {
    throw new Error(
      \`Expected a resized WebP width of 64px, got \${JSON.stringify(
        resizedWebPBlobs,
      )}\`,
    );
  }
  if (resizedWebPBlobs.every(blob => blob.width === initialWebPBlob.width)) {
    throw new Error(
      \`Expected resize to change WebP dimensions from \${initialWebPBlob.width}px\`,
    );
  }

  await page.locator('button[title="Save side settings"]').first().click();
  await page.waitForFunction(
    () => {
      const serialized = localStorage.getItem('rightSideSettings');
      if (!serialized) return false;

      try {
        const saved = JSON.parse(serialized);
        return (
          saved &&
          saved.version === 1 &&
          saved.settings &&
          saved.settings.latestSettings &&
          saved.settings.latestSettings.encoderState &&
          saved.settings.latestSettings.encoderState.type === 'webP'
        );
      } catch {
        return false;
      }
    },
    null,
    { timeout: 5000 },
  );
  const savedRightSideSettings = await page.evaluate(() => {
    const serialized = localStorage.getItem('rightSideSettings');
    if (!serialized) return;
    const saved = JSON.parse(serialized);
    return {
      version: saved.version,
      encoderType: saved.settings.latestSettings.encoderState.type,
    };
  });

  await selectEncoderOutput(1, 'MozJPEG');
  await page.waitForFunction(
    () => !document.title.startsWith('⏳'),
    null,
    { timeout: 30000 },
  );
  const changedOutput = await getRightOutputLabel();
  if (changedOutput !== 'MozJPEG') {
    throw new Error(\`Expected temporary MozJPEG output, got \${changedOutput}\`);
  }
  await page.locator('button[title="Import saved side settings"]').first().click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('select')]
        .filter(select =>
          [...select.options].some(option => option.text === 'WebP'),
        )
        .at(1)?.selectedOptions[0]?.text === 'WebP',
    null,
    { timeout: 10000 },
  );
  const importedOutput = await getRightOutputLabel();
  if (importedOutput !== 'WebP') {
    throw new Error(\`Expected imported WebP output, got \${importedOutput}\`);
  }

  await page.goto(${JSON.stringify(origin)});
  await input.waitFor({
    state: 'attached',
    timeout: 15000,
  });
  await input.setInputFiles(${JSON.stringify(extensionlessSampleImage)});
  await page.waitForURL('**/editor', { timeout: 15000 });
  await page.waitForFunction(
    () => document.title.includes('icon-large'),
    null,
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => !document.title.startsWith('⏳'),
    null,
    { timeout: 30000 },
  );
  await selectWebPOutput('icon-large.webp');
  const extensionlessLinks = await getBlobDownloads();
  const extensionlessDownload = extensionlessLinks.find(
    link => link.download === 'icon-large.webp' && link.href.startsWith('blob:'),
  );
  if (!extensionlessDownload) {
    throw new Error(
      \`Missing extensionless icon-large.webp blob download. Links: \${JSON.stringify(
        extensionlessLinks,
      )}\`,
    );
  }

  allowOfflineResourceErrors = true;
  await page.context().setOffline(true);
  try {
    await page.goto(${JSON.stringify(origin)});
    await input.waitFor({
      state: 'attached',
      timeout: 15000,
    });
  } finally {
    await page.context().setOffline(false);
    allowOfflineResourceErrors = false;
  }

  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'serviceWorker', {
      configurable: true,
      get() {
        return undefined;
      },
    });
  });
  await page.goto(${JSON.stringify(origin)} + '?no-service-worker=1');
  await input.waitFor({
    state: 'attached',
    timeout: 15000,
  });
  const serviceWorkerDisabled = await page.evaluate(
    () => typeof navigator.serviceWorker === 'undefined',
  );
  if (!serviceWorkerDisabled) {
    throw new Error('Expected service worker API to be unavailable');
  }

  if (consoleErrors.length) {
    throw new Error(\`Console errors during smoke: \${consoleErrors.join('\\n')}\`);
  }

  return {
    url: page.url(),
    title: await page.title(),
    selected,
    download: webpDownload.download,
    extensionlessDownload: extensionlessDownload.download,
    offlineAppShell: await page.locator('input[type=file]').first().count(),
    serviceWorkerDisabledAppShell: await page
      .locator('input[type=file]')
      .first()
      .count(),
    savedRightSideSettings,
    importedOutput,
  };
}
`;

    const result = await run(
      'playwright-cli',
      ['-s', sessionName, 'run-code', smokeCode],
      { capture: true },
    );
    if (result.stdout.includes('### Error')) {
      throw new Error(result.stdout.trim());
    }
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  } finally {
    await run('playwright-cli', ['-s', sessionName, 'close'], {
      capture: true,
    }).catch(() => {});
    preview.kill('SIGTERM');
  }
}

runBrowserSmoke().catch((error) => {
  console.error(error.message);
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
});
