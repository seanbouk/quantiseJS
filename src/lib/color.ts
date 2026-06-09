// Core colour primitives and quantisation helpers (framework-agnostic).

export type RGB = [number, number, number]

export interface ColorCount {
  color: RGB
  count: number
}

/** Perceptually-weighted squared distance. Cheap and good enough for palette work. */
export function dist2(a: RGB, b: RGB): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db
}

/** Index of the nearest colour in `palette` to `c`. */
export function nearestIndex(c: RGB, palette: RGB[]): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = dist2(c, palette[i])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Snap a single 0-255 channel to `bits` bits of precision (e.g. 3 -> 8 levels). */
export function snapChannel(v: number, bits: number): number {
  const levels = (1 << bits) - 1
  return Math.round((Math.round((v / 255) * levels) / levels) * 255)
}

export function snapDepth(c: RGB, bits: number): RGB {
  return [snapChannel(c[0], bits), snapChannel(c[1], bits), snapChannel(c[2], bits)]
}

export function rgbToHex(c: RGB): string {
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function channelRange(bucket: ColorCount[]): { range: number; channel: number } {
  const min: RGB = [255, 255, 255]
  const max: RGB = [0, 0, 0]
  for (const { color } of bucket) {
    for (let c = 0; c < 3; c++) {
      if (color[c] < min[c]) min[c] = color[c]
      if (color[c] > max[c]) max[c] = color[c]
    }
  }
  const ranges = [
    (max[0] - min[0]) * 0.299,
    (max[1] - min[1]) * 0.587,
    (max[2] - min[2]) * 0.114,
  ]
  let channel = 0
  if (ranges[1] > ranges[channel]) channel = 1
  if (ranges[2] > ranges[channel]) channel = 2
  return { range: ranges[channel], channel }
}

function averageColor(bucket: ColorCount[]): RGB {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (const { color, count } of bucket) {
    r += color[0] * count
    g += color[1] * count
    b += color[2] * count
    n += count
  }
  if (n === 0) return [0, 0, 0]
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

/**
 * Median-cut colour quantisation. Splits the colour cloud along its widest
 * (perceptually-weighted) axis until we have `k` buckets, then averages each.
 */
export function medianCut(pixels: ColorCount[], k: number): RGB[] {
  if (pixels.length === 0 || k <= 0) return []
  if (pixels.length <= k) return pixels.map((p) => p.color)

  let buckets: ColorCount[][] = [pixels]
  while (buckets.length < k) {
    let bestBucket = -1
    let bestRange = -1
    let bestChannel = 0
    for (let b = 0; b < buckets.length; b++) {
      if (buckets[b].length < 2) continue
      const { range, channel } = channelRange(buckets[b])
      if (range > bestRange) {
        bestRange = range
        bestBucket = b
        bestChannel = channel
      }
    }
    if (bestBucket < 0) break // nothing left worth splitting

    const bucket = buckets[bestBucket]
    bucket.sort((x, y) => x.color[bestChannel] - y.color[bestChannel])
    const total = bucket.reduce((s, c) => s + c.count, 0)
    let acc = 0
    let splitIdx = 1
    for (let i = 0; i < bucket.length; i++) {
      acc += bucket[i].count
      if (acc >= total / 2) {
        splitIdx = i + 1
        break
      }
    }
    splitIdx = Math.max(1, Math.min(splitIdx, bucket.length - 1))
    buckets.splice(bestBucket, 1, bucket.slice(0, splitIdx), bucket.slice(splitIdx))
  }
  return buckets.map(averageColor)
}

/** Build a colour->count histogram from a flat RGB array, keyed by packed int. */
export function histogram(rgb: RGB[]): ColorCount[] {
  const map = new Map<number, number>()
  for (const c of rgb) {
    const key = (c[0] << 16) | (c[1] << 8) | c[2]
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const out: ColorCount[] = []
  for (const [key, count] of map) {
    out.push({ color: [(key >> 16) & 255, (key >> 8) & 255, key & 255], count })
  }
  return out
}
