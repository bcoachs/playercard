# IMG.LY Background Removal Assets

The background removal client resolves its model bundle from the URL defined in
`NEXT_PUBLIC_IMG_LY_PUBLIC_PATH`. When this variable points to a relative path
(for example `/imgly-assets/`), the client converts it into an absolute URL at
runtime by combining it with `window.location.origin`.

If you prefer to host the IMG.LY assets yourself, copy the contents of the
`@imgly/background-removal-data` npm package into this folder and set
`NEXT_PUBLIC_IMG_LY_PUBLIC_PATH=/imgly-assets/`.

When no path is configured the application falls back to the official IMG.LY
CDN using the version indicated by `NEXT_PUBLIC_IMG_LY_ASSET_VERSION`
(defaulting to `1.7.0`).
