// Resize a source image to the target output resolution and return ImageData.

export type FitMode = 'stretch' | 'fit' | 'fill'

/**
 * Compute the destination rect for drawing `img` into a `tw`x`th` frame.
 *  - stretch: fill the frame, ignoring aspect (distorts)
 *  - fit:     scale to fit entirely inside the frame, preserving aspect (letterbox)
 *  - fill:    scale to cover the frame, preserving aspect (crops overflow)
 */
function destRect(iw: number, ih: number, tw: number, th: number, mode: FitMode) {
  if (mode === 'stretch') return { dx: 0, dy: 0, dw: tw, dh: th }
  const scale =
    mode === 'fit' ? Math.min(tw / iw, th / ih) : Math.max(tw / iw, th / ih)
  const dw = iw * scale
  const dh = ih * scale
  return { dx: (tw - dw) / 2, dy: (th - dh) / 2, dw, dh }
}

export function imageToImageData(
  img: HTMLImageElement,
  width: number,
  height: number,
  smooth: boolean,
  mode: FitMode = 'stretch',
): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  // Letterbox bars (fit mode) are filled black so they quantise predictably.
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = smooth
  ctx.imageSmoothingQuality = 'high'
  const { dx, dy, dw, dh } = destRect(img.width, img.height, width, height, mode)
  ctx.drawImage(img, dx, dy, dw, dh)
  return ctx.getImageData(0, 0, width, height)
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
