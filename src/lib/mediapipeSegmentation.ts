import { FilesetResolver, SelfieSegmentation } from '@mediapipe/tasks-vision'

let cachedSelfieSegmentation: SelfieSegmentation | null = null
let loadingPromise: Promise<SelfieSegmentation> | null = null

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
const MODEL_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/models/selfie_segmentation_landscape.tflite'

function assertBrowser(message: string): void {
  if (typeof window === 'undefined') {
    throw new Error(message)
  }
}

export async function loadSelfieSegmentation(): Promise<SelfieSegmentation> {
  if (cachedSelfieSegmentation) {
    return cachedSelfieSegmentation
  }

  if (loadingPromise) {
    return loadingPromise
  }

  assertBrowser('Die Mediapipe-Segmentierung steht nur im Browser zur Verfügung.')

  loadingPromise = (async () => {
    const resolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
    const instance = await SelfieSegmentation.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
      },
      runningMode: 'image',
      outputConfidenceMasks: true,
    })
    cachedSelfieSegmentation = instance
    return instance
  })()

  try {
    return await loadingPromise
  } catch (error) {
    loadingPromise = null
    cachedSelfieSegmentation = null
    throw error
  }
}

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  assertBrowser('Canvas können nur im Browser erzeugt werden.')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext2d(canvas: OffscreenCanvas | HTMLCanvasElement): Canvas2DContext {
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

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/png' })
  }

  return await new Promise<Blob>((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Segmentiertes Bild konnte nicht erstellt werden.'))
      }
    }, 'image/png')
  })
}

export async function removeBackgroundWithMediapipe(
  file: Blob,
  background?: HTMLImageElement | string,
): Promise<Blob> {
  const segmentation = await loadSelfieSegmentation()
  const bitmap = await createImageBitmap(file)
  let confidenceMask: ImageBitmap | undefined

  try {
    const result = await segmentation.segment(bitmap)
    confidenceMask = result?.confidenceMask as ImageBitmap | undefined
    if (!confidenceMask) {
      throw new Error('Keine Segmentierungsmaske erhalten.')
    }

    const width = bitmap.width
    const height = bitmap.height
    if (!width || !height) {
      throw new Error('Bild konnte nicht verarbeitet werden.')
    }

    const canvas = createCanvas(width, height)
    const context = getContext2d(canvas)

    if (background) {
      if (typeof background === 'string') {
        applyStringBackground(context, width, height, background)
      } else {
        context.drawImage(background, 0, 0, width, height)
      }
    }

    context.globalCompositeOperation = 'destination-out'
    context.drawImage(confidenceMask, 0, 0, width, height)
    context.globalCompositeOperation = 'destination-over'
    context.drawImage(bitmap, 0, 0, width, height)

    return await canvasToBlob(canvas)
  } finally {
    if (confidenceMask && typeof confidenceMask.close === 'function') {
      confidenceMask.close()
    }
    if (typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}
