# Feature types

- **decoders** - decode images.
- **encoders** - encode images.
- **processors** - change images, generally in a way that potentially aids compression.
- **preprocessors** - prepares the image for handling.

The key difference between preprocessors and processors is each 'side' in the editor can process differently, whereas a preprocessor happens to both sides.

# Adding code to the worker

Worker methods are enumerated explicitly in `scripts/sync-sveltekit-app.mjs`.
During `npm run sync`, the generated worker imports each listed feature's
`worker/runtime.ts` factory directly and wires it into the Comlink bridge. Adding
a method means adding it to the sync script's worker-method list and providing
the corresponding runtime factory; arbitrary `worker/*.ts` default exports are
not auto-exposed by filename.

# Folders

Within a feature, files in the:

- `client` folder will be part of the client project.
- `worker` folder will be part of the worker project.
- `shared` folder will be part of the shared project. Both the client and worker projects can access the shared project.

# Encoder format

Encoders must have the following:

`shared/meta.ts` which exposes the following:

- `label` - The name of the codec as displayed to the user.
- `mimeType` - The mime type to be used when generating the output file.
- `extension` - The file extension to be used when generating the output file.
- `EncodeOptions` - An interface for the codec's options.
- `defaultOptions` - An object of type `EncodeOptions`.

`client/index.ts` which exposes the following:

- `encode` - A method which takes args:
  - `AbortSignal`
  - `WorkerBridge`
  - `ImageData`
  - `EncodeOptions`

And returns (a promise for) an `ArrayBuffer`.

Optionally it may export a method `featureTest`, which returns a boolean indicating support for this decoder.

Optionally it may export a component, `Options`, with the following props:

```ts
interface Props {
  options: EncodeOptions;
  onChange(newOptions: EncodeOptions): void;
}
```

…where `EncodeOptions` are the options for that encoder.
