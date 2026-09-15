# ArthoLingo — Flat GitHub Upload Package

This package intentionally contains **one top-level folder only** and no subfolders inside it. All runtime files, dictionary data, scripts, CSS, and icon files are placed directly in the same directory so the contents can be uploaded into a GitHub repository without recreating nested folders.

## Deployment

Open `index.html` from the repository root in Vercel as a static site. No build command is required.

## Important

Keep every file in this directory together. The HTML, JavaScript, CSS, service worker, manifest, dictionary JSON, lexical indexes, and icons reference these flat filenames.
