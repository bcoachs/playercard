import * as bodyPix from '@tensorflow-models/body-pix'
import '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'

let cachedNet: bodyPix.BodyPix | null = null
let loadingPromise: Promise<bodyPix.BodyPix> | null = null
let tfReadyPromise: Promise<void> | null = null

function assertBrowser(message: string): void {
  if (typeof window === 'undefined') {
    throw new Error(message)
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  assertBrowser('Canvas können nur im Browser erzeugt werden.')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('2D-Rendering-Kontext konnte nicht initialisiert werden.')
  }
  return context
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  assertBrowser('Bilddaten können nur im Browser verarbeitet werden.')
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = error => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    image.src = url
  })
}

async function ensureTfReady(): Promise<void> {
  assertBrowser('TensorFlow.js Backend steht nur im Browser zur Verfügung.')
  if (!tfReadyPromise) {
    tfReadyPromise = (async () => {
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl')
      }
      await tf.ready()
    })().catch(error => {
      tfReadyPromise = null
      throw error
    })
  }
  await tfReadyPromise
}

function applyStringBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
): void {
  const trimmed = background.trim()
  if (!trimmed) return

  if (/gradient/i.test(trimmed)) {
    const startIndex = trimmed.indexOf('(')
    const endIndex = trimmed.lastIndexOf(')')
    if (startIndex >= 0 && endIndex > startIndex) {
      const inner = trimmed.slice(startIndex + 1, endIndex)
      const parts = inner
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
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

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  assertBrowser('Hintergrundbilder können nur im Browser geladen werden.')
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Hintergrundbild konnte nicht geladen werden.'))
    image.src = src
  })
}

async function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
): Promise<void> {
  const trimmed = background.trim()
  if (!trimmed) return

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('data:')
  ) {
    const image = await loadImageElement(trimmed)
    context.drawImage(image, 0, 0, width, height)
    return
  }

  applyStringBackground(context, width, height, trimmed)
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

export async function loadBodyPix(): Promise<bodyPix.BodyPix> {
  if (cachedNet) {
    return cachedNet
  }
  if (loadingPromise) {
    return loadingPromise
  }

  assertBrowser('BodyPix steht nur im Browser zur Verfügung.')

  await ensureTfReady()

  loadingPromise = bodyPix
    .load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    })
    .then(instance => {
      cachedNet = instance
      return instance
    })
    .catch(error => {
      loadingPromise = null
      cachedNet = null
      throw error
    })

  return await loadingPromise
}

export async function removeBackground(imageBlob: Blob, background?: string): Promise<Blob> {
  const net = await loadBodyPix()
  const imgElement = await blobToImage(imageBlob)

  const segmentation = await net.segmentPerson(imgElement, {
    internalResolution: 'medium',
    segmentationThreshold: 0.7,
  })

  const width =
    segmentation.width ?? (imgElement.naturalWidth || imgElement.width)
  const height =
    segmentation.height ?? (imgElement.naturalHeight || imgElement.height)

  const subjectCanvas = createCanvas(width, height)
  const subjectContext = getContext2d(subjectCanvas)
  subjectContext.drawImage(imgElement, 0, 0, width, height)

  const imageData = subjectContext.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const trimmedBackground = background?.trim()
  const rgbMatch =
    trimmedBackground && /^rgba?\(/i.test(trimmedBackground)
      ? trimmedBackground.match(/\d+/g)
      : null
  const useDirectColor = Boolean(rgbMatch && rgbMatch.length >= 3)
  const colorComponents = useDirectColor
    ? rgbMatch!.slice(0, 3).map(Number)
    : null

  segmentation.data.forEach((isPerson: number, idx: number) => {
    const offset = idx * 4
    if (!isPerson) {
      if (useDirectColor && colorComponents) {
        pixels[offset] = colorComponents[0]
        pixels[offset + 1] = colorComponents[1]
        pixels[offset + 2] = colorComponents[2]
        pixels[offset + 3] = 255
      } else {
        pixels[offset + 3] = 0
      }
    }
  })

  subjectContext.putImageData(imageData, 0, 0)

  if (trimmedBackground && !useDirectColor) {
    const finalCanvas = createCanvas(width, height)
    const finalContext = getContext2d(finalCanvas)
    await drawBackground(finalContext, width, height, trimmedBackground)
    finalContext.drawImage(subjectCanvas, 0, 0, width, height)
    return await canvasToBlob(finalCanvas)
  }

  return await canvasToBlob(subjectCanvas)
}
