# SquooshPlus

SquooshPlus is a fork of [Squoosh], an image compression web app that reduces image sizes through numerous formats. This fork is focused on making the app easier to maintain and adding practical bulk image optimization workflows.

## Project docs

- [Project overview](docs/overview.md)
- [Build and runtime map](docs/build-and-runtime.md)
- [Road map](docs/road-map.md)
- [Cleanup todo](docs/todo.md)
- [Maintenance status](docs/maintenance-status.md)

# Privacy

SquooshPlus does not send your image to a server. Image compression runs locally in your browser.

This fork does not include the inherited Google Analytics integration from upstream Squoosh.

# Developing

Use the Node version in [.nvmrc](.nvmrc).

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
npm run typecheck
npm run format:check
```

# Contributing

Squoosh is an open-source project that appreciates all community involvement. To contribute to the project, follow the [contribute guide](/CONTRIBUTING.md).

[squoosh]: https://squoosh.app
