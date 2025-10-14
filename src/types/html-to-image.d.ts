declare module 'html-to-image' {
  export type BaseOptions = {
    cacheBust?: boolean
    useCors?: boolean
    backgroundColor?: string
    width?: number
    height?: number
    canvasWidth?: number
    canvasHeight?: number
    pixelRatio?: number
    style?: Partial<CSSStyleDeclaration>
    filter?: (element: Element) => boolean
    skipAutoScale?: boolean
  }

  export type JpegOptions = BaseOptions & {
    quality?: number
  }

  export function toPng(node: HTMLElement, options?: BaseOptions): Promise<string>
  export function toJpeg(node: HTMLElement, options?: JpegOptions): Promise<string>
}
