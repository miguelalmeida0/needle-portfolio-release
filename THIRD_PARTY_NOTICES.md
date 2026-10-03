# Third-party notices

## The Metropolitan Museum of Art Open Access dataset

Needle's optional local data packs are built from `metmuseum/openaccess`, an official image-and-text dataset distributed under CC0 1.0. The installer preserves object identifiers, source-record links, credit lines, and the dataset revision checksum in the pack manifest.

The application code archive does not redistribute a prebuilt multi-gigabyte museum pack. Users explicitly create a local pack from the public Open Access source.

## React runtime

`vendor/react-runtime.js` contains React and React DOM runtime code distributed under the MIT License. Copyright Meta Platforms, Inc. and affiliates.

## TypeScript compiler fallback

`tools/typescript` contains a pinned TypeScript compiler fallback distributed under the Apache License 2.0. Original license and notice files remain in that directory.

## Performance tooling

Sharp is distributed under Apache-2.0; its platform libvips packages include their own dependency license notices. esbuild uses the MIT License. Playwright is a development/test dependency distributed under Apache-2.0. These packages are installed through the pinned npm lockfile; their original notices remain in their installed packages.
