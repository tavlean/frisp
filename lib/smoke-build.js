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

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exitCode = 1;
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(buildDir, file)), `Missing build/${file}`);
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
