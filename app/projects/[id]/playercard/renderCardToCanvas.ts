function toCssText(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .map(name => `${name}:${style.getPropertyValue(name)};`)
    .join(' ')
}

async function inlineImage(source: HTMLImageElement, target: HTMLImageElement): Promise<void> {
  const url = source.currentSrc || source.src
  if (!url) return
  if (url.startsWith('data:')) {
    target.src = url
    target.removeAttribute('srcset')
    return
  }
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`Failed to load image: ${response.status}`)
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    if (dataUrl) {
      target.src = dataUrl
      target.removeAttribute('srcset')
    }
  } catch (error) {
    console.warn('Bild konnte nicht eingebettet werden:', error)
  }
}

async function inlineStyles(source: Element, target: Element): Promise<void> {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    const style = window.getComputedStyle(source)
    target.setAttribute('style', toCssText(style))
  }

  if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
    await inlineImage(source, target)
  }

  const sourceChildren = Array.from(source.children)
  const targetChildren = Array.from(target.children)
  await Promise.all(
    sourceChildren.map((child, index) => {
      const targetChild = targetChildren[index]
      if (child instanceof Element && targetChild instanceof Element) {
        return inlineStyles(child, targetChild)
      }
      return Promise.resolve()
    }),
  )
}

function serializeNode(node: HTMLElement): string {
  node.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  return new XMLSerializer().serializeToString(node)
}

function createSvgMarkup(node: HTMLElement, width: number, height: number): string {
  const serialized = serializeNode(node)
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

type RenderOptions = {
  scale?: number
  minWidth?: number
  minHeight?: number
}

export async function renderCardToCanvas(
  element: HTMLElement,
  options: RenderOptions | number = {},
): Promise<HTMLCanvasElement> {
  const resolvedOptions = typeof options === 'number' ? { scale: options } : options
  const baseScale = resolvedOptions.scale ?? 1
  const minWidth = resolvedOptions.minWidth ?? 0
  const minHeight = resolvedOptions.minHeight ?? 0
  const clone = element.cloneNode(true) as HTMLElement
  await inlineStyles(element, clone)
  const { width, height } = element.getBoundingClientRect()
  const svgMarkup = createSvgMarkup(clone, width, height)
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    let ratio = Math.max(1, baseScale)
    if (minWidth > 0 && width > 0) {
      ratio = Math.max(ratio, minWidth / width)
    }
    if (minHeight > 0 && height > 0) {
      ratio = Math.max(ratio, minHeight / height)
    }
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D-Kontext nicht verfügbar')
    ctx.scale(ratio, ratio)
    ctx.drawImage(img, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
