/// <reference types="vite/client" />
/// <reference path="./emscripten-types.d.ts" />

declare global {
  namespace App {
    // Shallow-routing state: a history entry marked as the open editor, so
    // browser/in-app Back returns to the intro. See routes/+page.svelte.
    interface PageState {
      editor?: boolean;
    }
  }

  var __appEmscriptenLocateFile:
    | ((path: string, prefix?: string) => string)
    | undefined;

  // The URL of a threaded (pthread) Emscripten codec's main glue, handed to the
  // pthread workers so they re-import the right module (see initEmscriptenModule
  // + the generated locateCodecWasm). Undefined for single-thread builds.
  var __appEmscriptenMainScriptUrlOrBlob: string | undefined;
}

export {};
