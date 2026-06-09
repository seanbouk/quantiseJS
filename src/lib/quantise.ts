import {
  dist2,
  histogram,
  medianCut,
  nearestIndex,
  snapDepth,
  type ColorCount,
  type RGB,
} from './color'
import type { DepthMode } from './presets'
import { dedupeTiles } from './tiles'

export type Dither =
  // ordered (threshold matrices)
  | 'none'
  | 'bayer2'
  | 'bayer4'
  | 'bayer8'
  | 'cluster4'
  // error diffusion
  | 'floyd'
  | 'falseFloyd'
  | 'jjn'
  | 'stucki'
  | 'atkinson'
  | 'burkes'
  | 'sierra'
  | 'sierra2'
  | 'sierraLite'
  // stochastic
  | 'random'

export interface QuantiseOptions {
  palettes: number
  colorsPerPalette: number // total entries incl. shared index 0
  maxColorsPerTile: number
  sharedBg: boolean
  bgColor?: RGB
  regionSize: number // palette-assignment block (NES attribute grid = 2x tile)
  tileSize: number // dedup block
  depth: DepthMode
  dither: Dither
  shadow: boolean // x0.5 brightness variants (Mega Drive shadow)
  highlight: boolean // x1.5 brightness variants (Mega Drive highlight)
  maxUniqueTiles: number // 0 = unlimited
  flipH: boolean
  flipV: boolean
  rotate: boolean
  iterations?: number
}

export interface QuantiseStats {
  width: number
  height: number
  regionsX: number
  regionsY: number
  palettesUsed: number
  uniqueColorsOut: number
  naturalUniqueTiles: number
  uniqueTiles: number
  tilesX: number
  tilesY: number
}

export interface QuantiseResult {
  imageData: ImageData
  palettes: RGB[][] // expanded (incl. brightness variants) for display
  stats: QuantiseStats
}

interface Region {
  hist: ColorCount[]
  avg: RGB
}

// Ordered threshold matrices. Values 0..(n*n-1); normalised to a [-0.5,0.5)
// offset at render time. Includes Bayer (recursive) sizes + a clustered-dot
// (halftone) matrix.
const ORDERED: Record<string, number[][]> = {
  bayer2: [
    [0, 2],
    [3, 1],
  ],
  bayer4: [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ],
  bayer8: [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ],
  cluster4: [
    [12, 5, 6, 13],
    [4, 0, 1, 7],
    [11, 3, 2, 8],
    [15, 10, 9, 14],
  ],
}
const DITHER_AMP = 36

// Error-diffusion kernels as [dx, dy, weight] with a shared divisor. Only
// forward/below cells (scan order), so a single left-to-right pass works.
type Kernel = { div: number; cells: [number, number, number][] }
const DIFFUSION: Record<string, Kernel> = {
  floyd: { div: 16, cells: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  falseFloyd: { div: 8, cells: [[1, 0, 3], [0, 1, 3], [1, 1, 2]] },
  jjn: {
    div: 48,
    cells: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
  },
  stucki: {
    div: 42,
    cells: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
    ],
  },
  atkinson: {
    // distributes only 6/8 of the error — the classic washed-out Mac look
    div: 8,
    cells: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]],
  },
  burkes: {
    div: 32,
    cells: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]],
  },
  sierra: {
    div: 32,
    cells: [
      [1, 0, 5], [2, 0, 3],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
      [-1, 2, 2], [0, 2, 3], [1, 2, 2],
    ],
  },
  sierra2: {
    div: 16,
    cells: [[1, 0, 4], [2, 0, 3], [-2, 1, 1], [-1, 1, 2], [0, 1, 3], [1, 1, 2], [2, 1, 1]],
  },
  sierraLite: { div: 4, cells: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
}

const clamp8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

function applyDepth(c: RGB, depth: DepthMode): RGB {
  switch (depth.kind) {
    case 'none':
      return c
    case 'bits':
      return snapDepth(c, depth.bits)
    case 'fixed':
      return depth.palette[nearestIndex(c, depth.palette)]
  }
}

/** Append shadow / highlight variants used for matching + display. */
function expandBrightness(pal: RGB[], shadow: boolean, highlight: boolean): RGB[] {
  if (!shadow && !highlight) return pal
  const out = pal.slice()
  const scale = (c: RGB, f: number): RGB => [clamp8(c[0] * f), clamp8(c[1] * f), clamp8(c[2] * f)]
  if (shadow) for (const c of pal) out.push(scale(c, 0.5))
  if (highlight) for (const c of pal) out.push(scale(c, 1.5))
  return out
}

function tileCost(region: Region, palette: RGB[]): number {
  let cost = 0
  for (const { color, count } of region.hist) {
    cost += count * dist2(color, palette[nearestIndex(color, palette)])
  }
  return cost
}

function buildPalette(pool: ColorCount[], size: number, sharedBg: boolean, bg: RGB | null): RGB[] {
  if (sharedBg && bg) {
    const rest = medianCut(pool, Math.max(0, size - 1))
    const pal = [bg, ...rest]
    while (pal.length < size) pal.push(bg)
    return pal.slice(0, size)
  }
  const pal = medianCut(pool, size)
  while (pal.length < size) pal.push(pal[pal.length - 1] ?? [0, 0, 0])
  return pal.slice(0, size)
}

export function quantise(input: ImageData, opts: QuantiseOptions): QuantiseResult {
  const { width, height, data } = input
  const regionSize = Math.max(1, opts.regionSize)
  const paletteCount = Math.max(1, opts.palettes)
  const effectiveColors = Math.max(1, Math.min(opts.maxColorsPerTile, opts.colorsPerPalette))
  const iterations = opts.iterations ?? 4

  // 1. Depth-snap every pixel.
  const px: RGB[] = new Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    px[p] = applyDepth([data[i], data[i + 1], data[i + 2]], opts.depth)
  }

  // 2. Shared background colour.
  let bg: RGB | null = null
  if (opts.sharedBg) {
    if (opts.bgColor) {
      bg = applyDepth(opts.bgColor, opts.depth)
    } else {
      const global = histogram(px)
      global.sort((a, b) => b.count - a.count)
      bg = global[0]?.color ?? [0, 0, 0]
    }
  }

  // 3. Partition into palette regions.
  const regionsX = Math.ceil(width / regionSize)
  const regionsY = Math.ceil(height / regionSize)
  const regionCount = regionsX * regionsY
  const regions: Region[] = new Array(regionCount)
  for (let ry = 0; ry < regionsY; ry++) {
    for (let rx = 0; rx < regionsX; rx++) {
      const colors: RGB[] = []
      for (let y = ry * regionSize; y < Math.min((ry + 1) * regionSize, height); y++) {
        for (let x = rx * regionSize; x < Math.min((rx + 1) * regionSize, width); x++) {
          colors.push(px[y * width + x])
        }
      }
      const hist = histogram(colors)
      let r = 0
      let g = 0
      let b = 0
      let nn = 0
      for (const { color, count } of hist) {
        r += color[0] * count
        g += color[1] * count
        b += color[2] * count
        nn += count
      }
      regions[ry * regionsX + rx] = { hist, avg: nn ? [r / nn, g / nn, b / nn] : [0, 0, 0] }
    }
  }

  // 4. Seed palettes by farthest-point sampling over region averages.
  const seedIdx: number[] = []
  if (regionCount > 0) {
    let first = 0
    let mostColors = -1
    for (let i = 0; i < regionCount; i++) {
      if (regions[i].hist.length > mostColors) {
        mostColors = regions[i].hist.length
        first = i
      }
    }
    seedIdx.push(first)
    while (seedIdx.length < paletteCount) {
      let far = -1
      let farD = -1
      for (let i = 0; i < regionCount; i++) {
        let minD = Infinity
        for (const s of seedIdx) minD = Math.min(minD, dist2(regions[i].avg, regions[s].avg))
        if (minD > farD) {
          farD = minD
          far = i
        }
      }
      if (far < 0) break
      seedIdx.push(far)
    }
  }

  let palettes: RGB[][] = seedIdx.map((i) =>
    buildPalette(regions[i].hist, effectiveColors, opts.sharedBg, bg),
  )
  while (palettes.length < paletteCount) palettes.push(buildPalette([], effectiveColors, opts.sharedBg, bg))

  // 5. Lloyd iterations over regions. Costs use the brightness-expanded palette
  //    so shadow/highlight availability influences assignment.
  const assign = new Array<number>(regionCount).fill(0)
  for (let iter = 0; iter < iterations; iter++) {
    const matchPals = palettes.map((p) => expandBrightness(p, opts.shadow, opts.highlight))
    for (let i = 0; i < regionCount; i++) {
      let best = 0
      let bestCost = Infinity
      for (let p = 0; p < palettes.length; p++) {
        const cost = tileCost(regions[i], matchPals[p])
        if (cost < bestCost) {
          bestCost = cost
          best = p
        }
      }
      assign[i] = best
    }

    const pools: Map<number, number>[] = palettes.map(() => new Map())
    for (let i = 0; i < regionCount; i++) {
      const pool = pools[assign[i]]
      for (const { color, count } of regions[i].hist) {
        const key = (color[0] << 16) | (color[1] << 8) | color[2]
        pool.set(key, (pool.get(key) ?? 0) + count)
      }
    }
    for (let p = 0; p < palettes.length; p++) {
      const pool: ColorCount[] = []
      for (const [key, count] of pools[p]) {
        pool.push({ color: [(key >> 16) & 255, (key >> 8) & 255, key & 255], count })
      }
      if (pool.length === 0) {
        let worst = 0
        let worstCost = -1
        const mp = palettes.map((q) => expandBrightness(q, opts.shadow, opts.highlight))
        for (let i = 0; i < regionCount; i++) {
          const c = tileCost(regions[i], mp[assign[i]])
          if (c > worstCost) {
            worstCost = c
            worst = i
          }
        }
        palettes[p] = buildPalette(regions[worst]?.hist ?? [], effectiveColors, opts.sharedBg, bg)
      } else {
        palettes[p] = buildPalette(pool, effectiveColors, opts.sharedBg, bg)
      }
    }
  }

  const matchPals = palettes.map((p) => expandBrightness(p, opts.shadow, opts.highlight))
  const regionOf = (x: number, y: number) =>
    Math.floor(y / regionSize) * regionsX + Math.floor(x / regionSize)

  // 6. Render with optional dithering. Each pixel maps within its region palette.
  const outPx: RGB[] = new Array(width * height)
  const matrix = ORDERED[opts.dither as string]
  const kernel = DIFFUSION[opts.dither as string]

  if (kernel) {
    // Error diffusion: accumulate quantisation error into a working buffer.
    const buf = new Float32Array(width * height * 3)
    for (let i = 0; i < px.length; i++) {
      buf[i * 3] = px[i][0]
      buf[i * 3 + 1] = px[i][1]
      buf[i * 3 + 2] = px[i][2]
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const cur: RGB = [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]]
        const pal = matchPals[assign[regionOf(x, y)]]
        const chosen = pal[nearestIndex(cur, pal)]
        outPx[i] = chosen
        const er = cur[0] - chosen[0]
        const eg = cur[1] - chosen[1]
        const eb = cur[2] - chosen[2]
        for (const [dx, dy, w] of kernel.cells) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny >= height) continue
          const j = (ny * width + nx) * 3
          const f = w / kernel.div
          buf[j] += er * f
          buf[j + 1] += eg * f
          buf[j + 2] += eb * f
        }
      }
    }
  } else if (matrix || opts.dither === 'random') {
    // Ordered / stochastic: bias the source by a threshold offset, then map.
    const n = matrix ? matrix.length : 0
    const denom = n * n
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const off = matrix
          ? ((matrix[y % n][x % n] + 0.5) / denom - 0.5) * DITHER_AMP
          : (Math.random() - 0.5) * DITHER_AMP
        const src = px[i]
        const cur: RGB = [clamp8(src[0] + off), clamp8(src[1] + off), clamp8(src[2] + off)]
        const pal = matchPals[assign[regionOf(x, y)]]
        outPx[i] = pal[nearestIndex(cur, pal)]
      }
    }
  } else {
    // None
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const pal = matchPals[assign[regionOf(x, y)]]
        outPx[i] = pal[nearestIndex(px[i], pal)]
      }
    }
  }

  // 7. Tile dedup + max-unique-tile reduction.
  const dedup = dedupeTiles(outPx, width, height, {
    tileSize: opts.tileSize,
    flipH: opts.flipH,
    flipV: opts.flipV,
    rotate: opts.rotate,
    maxUniqueTiles: opts.maxUniqueTiles,
  })
  let finalPx = dedup.pixels
  // Re-clamp merged tiles back onto their region palette to stay legal.
  if (finalPx !== outPx) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const pal = matchPals[assign[regionOf(x, y)]]
        finalPx[i] = pal[nearestIndex(finalPx[i], pal)]
      }
    }
  }

  // 8. Write ImageData + stats.
  const out = new ImageData(width, height)
  const odata = out.data
  const usedColors = new Set<number>()
  for (let i = 0; i < finalPx.length; i++) {
    const c = finalPx[i]
    const o = i * 4
    odata[o] = c[0]
    odata[o + 1] = c[1]
    odata[o + 2] = c[2]
    odata[o + 3] = 255
    usedColors.add((c[0] << 16) | (c[1] << 8) | c[2])
  }

  return {
    imageData: out,
    palettes: matchPals,
    stats: {
      width,
      height,
      regionsX,
      regionsY,
      palettesUsed: new Set(assign).size,
      uniqueColorsOut: usedColors.size,
      naturalUniqueTiles: dedup.naturalUnique,
      uniqueTiles: dedup.uniqueCount,
      tilesX: Math.ceil(width / opts.tileSize),
      tilesY: Math.ceil(height / opts.tileSize),
    },
  }
}
