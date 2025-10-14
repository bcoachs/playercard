import { toJpeg, toPng } from 'html-to-image'

type ExportOptions = {
  asJpeg?: boolean
}

function createBaseOptions() {
  return {
    cacheBust: true,
    useCors: true,
    backgroundColor: '#0a1e38',
  } as const
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error('Unbekannter Fehler beim Export der Playercard.')
}

export async function exportPlayerCard(element: HTMLElement, options: ExportOptions = {}): Promise<string> {
  const { asJpeg = false } = options
  const baseOptions = createBaseOptions()

  if (asJpeg) {
    try {
      return await toJpeg(element, { ...baseOptions, quality: 0.95 })
    } catch (error) {
      if (error instanceof DOMException) {
        console.warn('JPEG-Export fehlgeschlagen. Fallback auf PNG wird verwendet.', error)
        return await toPng(element, baseOptions)
      }
      throw normalizeError(error)
    }
  }

  try {
    return await toPng(element, baseOptions)
  } catch (error) {
    throw normalizeError(error)
  }
}
