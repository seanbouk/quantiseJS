// Colour grading applied to the source image *before* quantisation. Intent:
// nudge the image away from greys (saturation) and toward friendlier regions
// of the console palette (hue / temperature), so the result reads as designed
// rather than merely digitised.

export interface Grade {
  brightness: number // -100..100, additive lift (shifts the black/white floor)
  contrast: number // -100..100
  saturation: number // -100..100 (negative = toward grey, positive = away)
  hue: number // -180..180 degrees
  temperature: number // -100..100 (blue <-> yellow)
  tint: number // -100..100 (green <-> magenta)
}

export const NEUTRAL_GRADE: Grade = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
}

export function isNeutral(g: Grade): boolean {
  return (
    g.brightness === 0 &&
    g.contrast === 0 &&
    g.saturation === 0 &&
    g.hue === 0 &&
    g.temperature === 0 &&
    g.tint === 0
  )
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

export function applyGrade(img: ImageData, g: Grade): ImageData {
  if (isNeutral(g)) return img

  const out = new ImageData(img.width, img.height)
  const src = img.data
  const dst = out.data

  const bright = g.brightness / 100 // additive lift in 0..1 space
  const contrast = 1 + g.contrast / 100 // 0..2
  const sat = 1 + g.saturation / 100 // 0..2
  const by = (g.temperature / 100) * 0.2 // blue(-) <-> yellow(+)
  const gm = (g.tint / 100) * 0.2 // green(-) <-> magenta(+)

  // luminance-preserving hue rotation matrix (SVG feColorMatrix form)
  const a = (g.hue * Math.PI) / 180
  const cosA = Math.cos(a)
  const sinA = Math.sin(a)
  const hueOn = g.hue !== 0
  const m = [
    0.213 + cosA * 0.787 - sinA * 0.213,
    0.715 - cosA * 0.715 - sinA * 0.715,
    0.072 - cosA * 0.072 + sinA * 0.928,
    0.213 - cosA * 0.213 + sinA * 0.143,
    0.715 + cosA * 0.285 + sinA * 0.14,
    0.072 - cosA * 0.072 - sinA * 0.283,
    0.213 - cosA * 0.213 - sinA * 0.787,
    0.715 - cosA * 0.715 + sinA * 0.715,
    0.072 + cosA * 0.928 + sinA * 0.072,
  ]

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i] / 255
    let gg = src[i + 1] / 255
    let b = src[i + 2] / 255

    // contrast (around mid-grey)
    r = (r - 0.5) * contrast + 0.5
    gg = (gg - 0.5) * contrast + 0.5
    b = (b - 0.5) * contrast + 0.5
    // brightness — additive lift applied after contrast, so it shifts the
    // whole tonal range including the black floor
    r += bright
    gg += bright
    b += bright
    // temperature (blue <-> yellow) and tint (green <-> magenta)
    r += by + gm
    gg += by - gm
    b += -by + gm
    // hue rotation
    if (hueOn) {
      const nr = r * m[0] + gg * m[1] + b * m[2]
      const ng = r * m[3] + gg * m[4] + b * m[5]
      const nb = r * m[6] + gg * m[7] + b * m[8]
      r = nr
      gg = ng
      b = nb
    }
    // saturation (lerp around luma)
    const L = 0.299 * r + 0.587 * gg + 0.114 * b
    r = L + (r - L) * sat
    gg = L + (gg - L) * sat
    b = L + (b - L) * sat

    dst[i] = clamp255(r * 255)
    dst[i + 1] = clamp255(gg * 255)
    dst[i + 2] = clamp255(b * 255)
    dst[i + 3] = 255
  }
  return out
}
