# ArthoLingo - GitHub / Vercel Deployment

This is the **flat GitHub upload build**.

## Required repository layout

All runtime files must stay directly in the repository root. Do not create `src/`, `assets/`, `tools/`, or other subfolders when uploading this build to GitHub.

The repository root should contain `index.html`, `app.css`, `app.js`, `pdf-generator.js`, `dictionary-engine.js`, `sw.js`, `manifest.json`, dictionary files, and the icon files.

## Vercel

- Framework Preset: `Other`
- Build Command: leave empty
- Install Command: leave empty
- Output Directory: `.`

Vercel serves `index.html` directly as the application entry point.

## Important

Keep all files together at the same directory level. The HTML, JavaScript, CSS, service worker, manifest, PDF engine, dictionary files, and icons all use flat relative paths.
