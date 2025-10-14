function toCssText(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .map(name => `${name}:${style.getPropertyValue(name)};`)
    .join(' ')
}

function normalizeUrl(url: string): string {
  try {
    return new URL(url, window.location.href).toString()
  } catch (error) {
    console.warn('URL konnte nicht normalisiert werden:', { url, error })
    return url
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function inlineImage(source: HTMLImageElement, target: HTMLImageElement): Promise<void> {
  const rawUrl = source.currentSrc || source.src
  if (!rawUrl) return
  if (rawUrl.startsWith('data:')) {
    target.src = rawUrl
    target.removeAttribute('srcset')
    return
  }
  const url = normalizeUrl(rawUrl)
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'include' })
    if (!response.ok) throw new Error(`Failed to load image: ${response.status}`)
    const blob = await response.blob()
    if (!blob.size) return
    const dataUrl = await blobToDataUrl(blob)
    if (dataUrl) {
      target.src = dataUrl
      target.removeAttribute('srcset')
    }
  } catch (error) {
    console.warn('Bild konnte nicht eingebettet werden:', error)
  }
}

async function inlineBackgroundImages(style: CSSStyleDeclaration, target: HTMLElement): Promise<void> {
  const backgroundImage = style.getPropertyValue('background-image')
  if (!backgroundImage || backgroundImage === 'none') return
  const matches = Array.from(backgroundImage.matchAll(/url\((['"]?)([^'"\)]+)\1\)/g))
  if (!matches.length) return
  let nextBackground = backgroundImage
  for (const match of matches) {
    const raw = match[2]
    if (!raw || raw.startsWith('data:')) continue
    const url = normalizeUrl(raw)
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'include' })
      if (!response.ok) continue
      const blob = await response.blob()
      if (!blob.size) continue
      const dataUrl = await blobToDataUrl(blob)
      const replacement = `url("${dataUrl}")`
      nextBackground = nextBackground.replace(match[0], replacement)
    } catch (error) {
      console.warn('Hintergrundbild konnte nicht eingebettet werden:', { url, error })
    }
  }
  target.style.setProperty('background-image', nextBackground)
}

async function inlineStyles(source: Element, target: Element): Promise<void> {
  if (source instanceof HTMLElement && target instanceof HTMLElement) {
    const style = window.getComputedStyle(source)
    target.setAttribute('style', toCssText(style))
    await inlineBackgroundImages(style, target)
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
