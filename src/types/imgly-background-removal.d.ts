declare module '@imgly/background-removal' {
  export type BackgroundRemovalConfig = {
    /**
     * Device to run the model on. `cpu` is the safest option for browsers without WebGPU.
     */
    device?: 'cpu' | 'gpu'
    /**
     * Optional public path that points to the directory containing the ONNX and WASM assets.
     */
    publicPath?: string
  }

  export function preload(config?: BackgroundRemovalConfig): Promise<void>

  export function removeBackground(
    file: Blob | File | string,
    options?: BackgroundRemovalConfig
  ): Promise<Blob>
}
