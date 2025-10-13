# IMG.LY Background Removal Assets

This folder is reserved for the ONNX and WebAssembly bundles shipped with
`@imgly/background-removal-data`. When running the application in an environment
without internet access, download the package and copy the contents of its
`dist/` directory into this folder so the background removal preload can resolve
all required assets locally.

At runtime the application serves `/imgly-assets/*` from this directory. In
production environments with outbound network access, those URLs are rewritten
to the official IMG.LY CDN via `next.config.mjs`, so no additional setup is
required.
