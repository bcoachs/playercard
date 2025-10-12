declare module '@imgly/background-removal' {
  type DeviceOption = 'cpu' | 'gpu' | 'webgpu' | 'wasm' | string

  export type RemoveBackgroundOptions = {
    device?: DeviceOption
    [key: string]: unknown
  }

  export type RemoveBackground = (
    file: Blob | File | string,
    options?: RemoveBackgroundOptions
  ) => Promise<Blob>

  export const removeBackground: RemoveBackground
  const defaultExport: RemoveBackground
  export default defaultExport
}
