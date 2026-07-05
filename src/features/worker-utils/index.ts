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
export function initEmscriptenModule<T extends EmscriptenWasm.Module>(
  moduleFactory: EmscriptenWasm.ModuleFactory<T>,
): Promise<T> {
  const globals = globalThis as {
    __appEmscriptenLocateFile?: (path: string, prefix?: string) => string;
    __appEmscriptenMainScriptUrlOrBlob?: string;
  };

  return moduleFactory({
    locateFile: globals.__appEmscriptenLocateFile,
    // Threaded (pthread) builds spawn worker copies of themselves that re-import
    // the main module via `import(Module.mainScriptUrlOrBlob)`. Under the bundler
    // the glue is served from a hashed `?url`, so we must hand the worker that URL
    // explicitly — otherwise it falls back to a relative `./<codec>_mt.js` that
    // 404s. Undefined for single-thread builds (they ignore it). The generated
    // `locateCodecWasm` sets it alongside __appEmscriptenLocateFile.
    mainScriptUrlOrBlob: globals.__appEmscriptenMainScriptUrlOrBlob,
    // Just to be safe, don't automatically invoke any wasm functions
    noInitialRun: true,
  });
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Response(blob).arrayBuffer();
}
