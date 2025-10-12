declare module '@imgly/background-removal' {
  export function removeBackground(
    file: Blob | File | string,
    options?: Record<string, unknown>
  ): Promise<Blob>
}
