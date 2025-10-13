import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

let cachedImageSegmenter: ImageSegmenter | null = null
let loadingPromise: Promise<ImageSegmenter> | null = null

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
const MODEL_URL = '/models/selfie_segmentation_landscape.tflite'

function assertBrowser(message: string): void {
  if (typeof window === 'undefined') {
    throw new Error(message)
  }
}

export async function loadImageSegmenter(): Promise<ImageSegmenter> {
  if (cachedImageSegmenter) {
    return cachedImageSegmenter
  }

  if (loadingPromise) {
    return loadingPromise
  }

  assertBrowser('Die Mediapipe-Segmentierung steht nur im Browser zur Verfügung.')

  loadingPromise = (async () => {
    const resolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
    const instance = await ImageSegmenter.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
      },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
    })
    cachedImageSegmenter = instance
    return instance
  })()

  try {
    return await loadingPromise
  } catch (error) {
    loadingPromise = null
    cachedImageSegmenter = null
    throw error
  }
}

type Canvas2DContext = CanvasRenderingContext2D

function createCanvas(width: number, height: number): HTMLCanvasElement {
  assertBrowser('Canvas können nur im Browser erzeugt werden.')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext2d(canvas: HTMLCanvasElement): Canvas2DContext {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('2D-Rendering-Kontext konnte nicht initialisiert werden.')
  }
  return context
}

function applyStringBackground(context: Canvas2DContext, width: number, height: number, background: string) {
  const trimmed = background.trim()
  if (!trimmed) return

  if (/gradient/i.test(trimmed)) {
    const startIndex = trimmed.indexOf('(')
    const endIndex = trimmed.lastIndexOf(')')
    if (startIndex >= 0 && endIndex > startIndex) {
      const inner = trimmed.slice(startIndex + 1, endIndex)
      const parts = inner.split(',').map(part => part.trim()).filter(Boolean)
      let colors = parts
      if (parts.length > 1 && /(deg|rad|turn|to\s)/i.test(parts[0])) {
        colors = parts.slice(1)
      }
      if (colors.length) {
        if (colors.length === 1) {
          context.fillStyle = colors[0]
        } else {
          const gradient = context.createLinearGradient(0, 0, width, height)
          const step = colors.length > 1 ? 1 / (colors.length - 1) : 1
          colors.forEach((color, index) => {
            gradient.addColorStop(Math.min(1, index * step), color)
          })
          context.fillStyle = gradient
        }
        context.fillRect(0, 0, width, height)
      }
    }
    return
  }

  context.fillStyle = trimmed
  context.fillRect(0, 0, width, height)
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Segmentiertes Bild konnte nicht erstellt werden.'))
      }
    }, 'image/png')
  })
}

type ConfidenceMaskCanvas = OffscreenCanvas | HTMLCanvasElement

function isCanvasLike(value: unknown): value is ConfidenceMaskCanvas {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ConfidenceMaskCanvas & { width?: unknown; height?: unknown }
  return (
    'getContext' in candidate &&
    typeof candidate.getContext === 'function' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  )
}

export async function removeBackgroundWithMediapipe(
  file: Blob,
  background?: HTMLImageElement | string,
): Promise<Blob> {
  const segmenter = await loadImageSegmenter()
  const bitmap = await createImageBitmap(file)

  try {
    const { confidenceMasks } = (await segmenter.segment(bitmap)) as {
      confidenceMasks?: ConfidenceMaskCanvas[]
    }

    const mask = confidenceMasks?.[0]
    if (!mask || !isCanvasLike(mask)) {
      throw new Error('Keine Segmentierungsmaske erhalten.')
    }

    const width = bitmap.width
    const height = bitmap.height
    if (!width || !height) {
      throw new Error('Bild konnte nicht verarbeitet werden.')
    }

    const subjectCanvas = createCanvas(width, height)
    const subjectContext = getContext2d(subjectCanvas)
    subjectContext.drawImage(bitmap, 0, 0, width, height)

    const maskCanvas = createCanvas(width, height)
    const maskContext = getContext2d(maskCanvas)
    maskContext.drawImage(mask as CanvasImageSource, 0, 0, width, height)
    const maskImageData = maskContext.getImageData(0, 0, width, height)
    const subjectImageData = subjectContext.getImageData(0, 0, width, height)
    const maskData = maskImageData.data
    const subjectData = subjectImageData.data
    const length = Math.min(subjectData.length, maskData.length)

    for (let i = 0; i < length; i += 4) {
      subjectData[i + 3] = maskData[i]
    }

    subjectContext.putImageData(subjectImageData, 0, 0)

    if (background) {
      const finalCanvas = createCanvas(width, height)
      const finalContext = getContext2d(finalCanvas)
      if (typeof background === 'string') {
        applyStringBackground(finalContext, width, height, background)
      } else {
        finalContext.drawImage(background, 0, 0, width, height)
      }
      finalContext.drawImage(subjectCanvas as CanvasImageSource, 0, 0, width, height)
      return await canvasToBlob(finalCanvas)
    }

    return await canvasToBlob(subjectCanvas)
  } finally {
    if (typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}
