/**
 * The single place the app's name lives in code. A rebrand changes this file,
 * package.json (name/homepage), the static brand assets, and prose docs —
 * nothing else. Internal identifiers (CSS classes, cache names, storage keys,
 * aliases) are deliberately brand-free and must stay that way.
 *
 * Two forms, deliberately separated:
 * - APP_NAME  — the brand as displayed: prose, titles, wordmarks, aria labels.
 * - APP_SLUG  — the lowercase identifier for filenames and machine-facing ids.
 *   Keep it in sync with the package name, CLI binary, and domain (all `frisp`).
 */
export const APP_NAME = 'Frisp';
export const APP_SLUG = 'frisp';
