# Sqush

Sqush is a practical image optimization web app derived from [Squoosh]. It is focused on maintainability, bulk image optimization workflows, and a smaller set of modern web image formats.

Website: [sqush.app](https://sqush.app)

## Project docs

- [Project overview](docs/overview.md)
- [Build and runtime map](docs/build-and-runtime.md)
- [Bulk image architecture](docs/bulk-image-architecture.md)
- [Codec provenance](docs/codec-provenance.md)
- [Dependency modernization](docs/dependency-modernization.md)
- [Manual QA checklist](docs/manual-qa.md)
- [Road map](docs/road-map.md)
- [Cleanup todo](docs/todo.md)
- [Upstream PR notes](docs/upstream-pr-notes.md)
- [Maintenance status](docs/maintenance-status.md)

# Privacy

Sqush does not send your image to a server. Image compression runs locally in your browser.

Sqush does not include the inherited Google Analytics integration from upstream Squoosh.

# Developing

Use the Node version in [.nvmrc](.nvmrc). The package metadata expects Node `>=20.16.0 <21` and npm `>=10`.

1. Install Node dependencies:
   ```sh
   npm install
   ```
1. Build the app:
   ```sh
   npm run build
   ```
1. Start the development server:
   ```sh
   npm run dev
   ```

Useful maintenance commands:

```sh
npm run check
npm run audit
npm run typecheck
npm run format:check
```

Run `npm run build` before `npm run typecheck` on a fresh checkout so generated feature files exist.

# Attribution

Sqush is derived from GoogleChromeLabs' Squoosh project and continues under the Apache 2.0 license.

# Contributing

Contributions should follow the [contribute guide](/CONTRIBUTING.md) until this fork has its own project-specific guide.

[squoosh]: https://github.com/GoogleChromeLabs/squoosh
