# SquooshPlus

SquooshPlus is a fork of [Squoosh], an image compression web app that reduces image sizes through numerous formats. This fork is focused on making the app easier to maintain and adding practical bulk image optimization workflows.

## Project docs

- [Project overview](docs/overview.md)
- [Build and runtime map](docs/build-and-runtime.md)
- [Road map](docs/road-map.md)
- [Cleanup todo](docs/todo.md)

# Privacy

Squoosh does not send your image to a server. All image compression processes locally.

However, Squoosh utilizes Google Analytics to collect the following:

- [Basic visitor data](https://support.google.com/analytics/answer/6004245?ref_topic=2919631).
- The before and after image size value.
- If Squoosh PWA, the type of Squoosh installation.
- If Squoosh PWA, the installation time and date.

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
