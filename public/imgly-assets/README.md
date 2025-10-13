# IMG.LY Background Removal Assets

This folder is reserved for the ONNX and WebAssembly bundles shipped with
`@imgly/background-removal-data`. The project mirrors the package into this
directory during `npm install` via the `postinstall` script in `package.json`.
If the automatic copy fails (for example when installing with a package manager
that ignores lifecycle hooks), run the command manually:

```
mkdir -p public/imgly-assets && cp -r node_modules/@imgly/background-removal-data/dist/. public/imgly-assets
```

The application now always serves `/imgly-assets/*` from this directory so the
background removal preload resolves all required assets locally without relying
on the IMG.LY CDN.
