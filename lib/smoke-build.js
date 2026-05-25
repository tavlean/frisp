/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.join(process.cwd(), 'build');
const requiredFiles = [
  'index.html',
  'manifest.json',
  'serviceworker.js',
  '_headers',
];
const requiredGeneratedFiles = [
  'src/features-worker/index.ts',
  'src/client/lazy-app/worker-bridge/meta.ts',
  'src/client/lazy-app/feature-meta/shared.ts',
  'src/client/lazy-app/feature-meta/index.ts',
  'src/client/lazy-app/feature-meta/encoders.ts',
];

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exitCode = 1;
  }
}

function getTagAttrs(html, tagName) {
  const tagPattern = new RegExp(`<${tagName}\\s+([^>]+)>`, 'gi');
  const attrPattern = /([a-z:-]+)\s*=\s*(['"])(.*?)\2/gi;
  const tagAttrs = [];
  let tagMatch;

  while ((tagMatch = tagPattern.exec(html))) {
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrPattern.exec(tagMatch[1]))) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[3];
    }
    tagAttrs.push(attrs);
  }

  return tagAttrs;
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value) || /^\/\//.test(value);
}

function assertNoExternalRuntimeDependencies(html) {
  for (const attrs of getTagAttrs(html, 'script')) {
    assert(
      !attrs.src || !isExternalUrl(attrs.src),
      `External script dependency found: ${attrs.src}`,
    );
  }

  for (const attrs of getTagAttrs(html, 'link')) {
    const rels = new Set((attrs.rel || '').toLowerCase().split(/\s+/));
    const runtimeRel = [
      'stylesheet',
      'preload',
      'modulepreload',
      'manifest',
      'icon',
      'apple-touch-icon',
      'shortcut',
    ].some((rel) => rels.has(rel));

    assert(
      !runtimeRel || !attrs.href || !isExternalUrl(attrs.href),
      `External runtime link found: ${attrs.href}`,
    );
  }
}

function assertManifestUsesLocalAssets(manifest) {
  for (const icon of manifest.icons || []) {
    assert(
      !icon.src || !isExternalUrl(icon.src),
      `External manifest icon found: ${icon.src}`,
    );
  }

  for (const screenshot of manifest.screenshots || []) {
    assert(
      !screenshot.src || !isExternalUrl(screenshot.src),
      `External manifest screenshot found: ${screenshot.src}`,
    );
  }
}

function getServiceWorkerAssetList(serviceWorkerJs) {
  const match = serviceWorkerJs.match(/const ASSETS = (\[[\s\S]*?\]);/);
  if (!match) return;
  return JSON.parse(match[1]);
}

function assertServiceWorkerAssetsExist(serviceWorkerJs) {
  const assets = getServiceWorkerAssetList(serviceWorkerJs);
  assert(Array.isArray(assets), 'Missing service worker asset list');
  if (!Array.isArray(assets)) return;

  for (const asset of assets) {
    assert(
      typeof asset === 'string' &&
        fs.existsSync(path.join(buildDir, asset.replace(/^\/+/, ''))),
      `Service worker references missing asset: ${asset}`,
    );
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(buildDir, file)), `Missing build/${file}`);
}

for (const file of requiredGeneratedFiles) {
  assert(fs.existsSync(path.join(process.cwd(), file)), `Missing ${file}`);
}

const indexPath = path.join(buildDir, 'index.html');
const manifestPath = path.join(buildDir, 'manifest.json');
const serviceWorkerPath = path.join(buildDir, 'serviceworker.js');

if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  assert(html.includes('<title>Sqush</title>'), 'Missing Sqush page title');
  assert(
    /<meta\s+char(?:s|S)et="utf-8"\s*\/?>/.test(html),
    'Missing UTF-8 charset metadata',
  );
  assert(
    !/google-analytics|googletagmanager|gtag\(/i.test(html),
    'Generated HTML contains analytics code',
  );
  assertNoExternalRuntimeDependencies(html);
}

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name === 'Sqush', 'Unexpected manifest name');
  assert(manifest.short_name === 'Sqush', 'Unexpected manifest short_name');
  assertManifestUsesLocalAssets(manifest);
}

if (fs.existsSync(serviceWorkerPath)) {
  const serviceWorkerJs = fs.readFileSync(serviceWorkerPath, 'utf8');
  assertServiceWorkerAssetsExist(serviceWorkerJs);
}

const assetsDir = path.join(buildDir, 'c');
assert(fs.existsSync(assetsDir), 'Missing build/c asset directory');

if (fs.existsSync(assetsDir)) {
  const assets = fs.readdirSync(assetsDir);
  assert(
    assets.some((file) => file.endsWith('.wasm')),
    'Missing emitted WebAssembly assets',
  );
  assert(
    assets.some((file) => file.startsWith('initial-app-')),
    'Missing initial app bundle',
  );
  assert(
    assets.some((file) => file.startsWith('Compress-')),
    'Missing lazy editor bundle',
  );
}

if (!process.exitCode) {
  console.log('Build smoke check passed');
}
