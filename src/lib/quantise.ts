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

export interface QuantiseOptions {
  palettes: number
  colorsPerPalette: number // total entries incl. shared index 0
  maxColorsPerTile: number
  sharedBg: boolean
  bgColor?: RGB // explicit shared colour; if omitted, auto-detected
  tileSize: number
  depth: DepthMode
  iterations?: number
}

export interface QuantiseStats {
  width: number
  height: number
  tilesX: number
  tilesY: number
  tileCount: number
  palettesUsed: number
  uniqueColorsOut: number
}

export interface QuantiseResult {
  imageData: ImageData
  palettes: RGB[][] // one entry per palette, each colorsPerPalette long
  tileAssignments: number[] // palette index per tile (row-major)
  stats: QuantiseStats
}

interface Tile {
  hist: ColorCount[] // distinct colours + counts within the tile
  avg: RGB
}

/** Snap a colour to the console gamut described by `depth`. */
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

/** Cost of drawing a tile with a given palette (lower = better fit). */
function tileCost(tile: Tile, palette: RGB[]): number {
  let cost = 0
  for (const { color, count } of tile.hist) {
    cost += count * dist2(color, palette[nearestIndex(color, palette)])
  }
  return cost
}

/** Build a palette from a pool of colours, reserving index 0 for the shared bg. */
function buildPalette(
  pool: ColorCount[],
  size: number,
  sharedBg: boolean,
  bg: RGB | null,
): RGB[] {
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
  const { width, height } = input
  const { tileSize, depth, sharedBg } = opts
  const paletteCount = Math.max(1, opts.palettes)
  const effectiveColors = Math.max(1, Math.min(opts.maxColorsPerTile, opts.colorsPerPalette))
  const iterations = opts.iterations ?? 4

  // 1. Read + depth-snap every pixel into a flat RGB grid.
  const px: RGB[] = new Array(width * height)
  const data = input.data
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    px[p] = applyDepth([data[i], data[i + 1], data[i + 2]], depth)
  }

  // 2. Determine the shared background colour (most frequent globally) if needed.
  let bg: RGB | null = null
  if (sharedBg) {
    if (opts.bgColor) {
      bg = applyDepth(opts.bgColor, depth)
    } else {
      const global = histogram(px)
      global.sort((a, b) => b.count - a.count)
      bg = global[0]?.color ?? [0, 0, 0]
    }
  }

  // 3. Partition into tiles, capturing each tile's colour histogram + average.
  const tilesX = Math.ceil(width / tileSize)
  const tilesY = Math.ceil(height / tileSize)
  const tileCount = tilesX * tilesY
  const tiles: Tile[] = new Array(tileCount)
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const colors: RGB[] = []
      for (let y = ty * tileSize; y < Math.min((ty + 1) * tileSize, height); y++) {
        for (let x = tx * tileSize; x < Math.min((tx + 1) * tileSize, width); x++) {
          colors.push(px[y * width + x])
        }
      }
      const hist = histogram(colors)
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (const { color, count } of hist) {
        r += color[0] * count
        g += color[1] * count
        b += color[2] * count
        n += count
      }
      const avg: RGB = n ? [r / n, g / n, b / n] : [0, 0, 0]
      tiles[ty * tilesX + tx] = { hist, avg }
    }
  }

  // 4. Seed palettes by farthest-point sampling over tile averages, so the
  //    starting palettes cover visually distinct regions of the image.
  const seedIdx: number[] = []
  if (tileCount > 0) {
    // first seed: the most colour-complex tile
    let first = 0
    let mostColors = -1
    for (let i = 0; i < tileCount; i++) {
      if (tiles[i].hist.length > mostColors) {
        mostColors = tiles[i].hist.length
        first = i
      }
    }
    seedIdx.push(first)
    while (seedIdx.length < paletteCount) {
      let far = -1
      let farD = -1
      for (let i = 0; i < tileCount; i++) {
        let minD = Infinity
        for (const s of seedIdx) minD = Math.min(minD, dist2(tiles[i].avg, tiles[s].avg))
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
    buildPalette(tiles[i].hist, effectiveColors, sharedBg, bg),
  )
  while (palettes.length < paletteCount) {
    palettes.push(buildPalette([], effectiveColors, sharedBg, bg))
  }

  // 5. Lloyd iterations: assign each tile to its cheapest palette, then rebuild
  //    each palette from the pooled colours of its member tiles.
  const assignments = new Array<number>(tileCount).fill(0)
  for (let iter = 0; iter < iterations; iter++) {
    // assignment step
    for (let i = 0; i < tileCount; i++) {
      let best = 0
      let bestCost = Infinity
      for (let p = 0; p < palettes.length; p++) {
        const cost = tileCost(tiles[i], palettes[p])
        if (cost < bestCost) {
          bestCost = cost
          best = p
        }
      }
      assignments[i] = best
    }

    // update step
    const pools: Map<number, number>[] = palettes.map(() => new Map())
    for (let i = 0; i < tileCount; i++) {
      const pool = pools[assignments[i]]
      for (const { color, count } of tiles[i].hist) {
        const key = (color[0] << 16) | (color[1] << 8) | color[2]
        pool.set(key, (pool.get(key) ?? 0) + count)
      }
    }
    for (let p = 0; p < palettes.length; p++) {
      const pool: ColorCount[] = []
      for (const [key, count] of pools[p]) {
        pool.push({ color: [(key >> 16) & 255, (key >> 8) & 255, key & 255], count })
      }
      // reseed empty palettes from the worst-fitting tile to avoid dead palettes
      if (pool.length === 0) {
        let worst = 0
        let worstCost = -1
        for (let i = 0; i < tileCount; i++) {
          const c = tileCost(tiles[i], palettes[assignments[i]])
          if (c > worstCost) {
            worstCost = c
            worst = i
          }
        }
        palettes[p] = buildPalette(tiles[worst]?.hist ?? [], effectiveColors, sharedBg, bg)
      } else {
        palettes[p] = buildPalette(pool, effectiveColors, sharedBg, bg)
      }
    }
  }

  // 6. Render: map each pixel to the nearest colour in its tile's palette.
  const out = new ImageData(width, height)
  const odata = out.data
  const usedColors = new Set<number>()
  const usedPalettes = new Set<number>()
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const palIdx = assignments[ty * tilesX + tx]
      usedPalettes.add(palIdx)
      const palette = palettes[palIdx]
      for (let y = ty * tileSize; y < Math.min((ty + 1) * tileSize, height); y++) {
        for (let x = tx * tileSize; x < Math.min((tx + 1) * tileSize, width); x++) {
          const src = px[y * width + x]
          const c = palette[nearestIndex(src, palette)]
          const o = (y * width + x) * 4
          odata[o] = c[0]
          odata[o + 1] = c[1]
          odata[o + 2] = c[2]
          odata[o + 3] = 255
          usedColors.add((c[0] << 16) | (c[1] << 8) | c[2])
        }
      }
    }
  }

  return {
    imageData: out,
    palettes,
    tileAssignments: assignments,
    stats: {
      width,
      height,
      tilesX,
      tilesY,
      tileCount,
      palettesUsed: usedPalettes.size,
      uniqueColorsOut: usedColors.size,
    },
  }
}
