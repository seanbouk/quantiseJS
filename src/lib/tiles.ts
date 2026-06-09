// Tile deduplication with flip/rotate equivalence + max-unique-tile reduction.
//
// On real hardware the same tile pattern is reused flipped H/V (and the VRAM
// only stores it once). We model that by treating a tile and its allowed
// transforms as the same unique tile, and — when the unique count exceeds the
// budget — merging visually-similar tiles via transform-aware k-means.
//
// Tiles may be oblong (W != H). Flips and 180° rotation work for any rectangle;
// 90°/270° rotation only applies to square tiles.

import type { RGB } from './color'

export interface DedupOptions {
  tileW: number
  tileH: number
  flipH: boolean
  flipV: boolean
  rotate: boolean // 90° rotations (square tiles only); 180° works for any shape
  maxUniqueTiles: number // 0 = unlimited (just report the natural count)
  iterations?: number
  collectMap?: boolean // also emit per-cell tilemap + unique-tile pixels (for export)
}

export interface TileMapEntry {
  tile: number // index into uniqueTiles
  fx: boolean // draw flipped horizontally
  fy: boolean // draw flipped vertically
  rot: number // 0 / 90 / 270 (90/270 square only)
}

export interface DedupResult {
  pixels: RGB[] // grid after any merging (unchanged if no reduction needed)
  naturalUnique: number // distinct tiles under flip-equivalence, before reduction
  uniqueCount: number // distinct tiles actually used after reduction
  tilesX: number
  tilesY: number
  // present only when collectMap was requested:
  map?: TileMapEntry[] // row-major per cell
  uniqueTiles?: number[][] // each a flat RGB array (tileW*tileH*3), canonical orientation
}

type TKey = 'id' | 'h' | 'v' | 'hv' | 'r90' | 'r270'

const INVERSE: Record<TKey, TKey> = {
  id: 'id',
  h: 'h',
  v: 'v',
  hv: 'hv',
  r90: 'r270',
  r270: 'r90',
}

/** Source coordinate that output (x,y) reads from, for transform `key`. */
function srcCoord(key: TKey, x: number, y: number, W: number, H: number): [number, number] {
  switch (key) {
    case 'id':
      return [x, y]
    case 'h':
      return [W - 1 - x, y]
    case 'v':
      return [x, H - 1 - y]
    case 'hv':
      return [W - 1 - x, H - 1 - y]
    case 'r90':
      return [y, W - 1 - x] // square only
    case 'r270':
      return [H - 1 - y, x] // square only
  }
}

/** Draw flags for a transform key (used to express the tilemap). */
function keyFlags(k: TKey): { fx: boolean; fy: boolean; rot: number } {
  switch (k) {
    case 'id':
      return { fx: false, fy: false, rot: 0 }
    case 'h':
      return { fx: true, fy: false, rot: 0 }
    case 'v':
      return { fx: false, fy: true, rot: 0 }
    case 'hv':
      return { fx: true, fy: true, rot: 0 }
    case 'r90':
      return { fx: false, fy: false, rot: 90 }
    case 'r270':
      return { fx: false, fy: false, rot: 270 }
  }
}

function allowedKeys(flipH: boolean, flipV: boolean, rotate: boolean, square: boolean): TKey[] {
  const keys: TKey[] = ['id']
  if (flipH) keys.push('h')
  if (flipV) keys.push('v')
  if ((flipH && flipV) || rotate) keys.push('hv') // 180° is shape-preserving
  if (rotate && square) keys.push('r90', 'r270')
  return keys
}

export function dedupeTiles(
  px: RGB[],
  width: number,
  height: number,
  opts: DedupOptions,
): DedupResult {
  const W = opts.tileW
  const H = opts.tileH
  const n = W * H
  const tilesX = Math.ceil(width / W)
  const tilesY = Math.ceil(height / H)
  const P = tilesX * tilesY
  const iterations = opts.iterations ?? 4

  const keys = allowedKeys(opts.flipH, opts.flipV, opts.rotate, W === H)
  const mapByKey = new Map<TKey, Int32Array>()
  for (const key of keys) buildMap(key)
  // inverse maps may be needed even if the key itself isn't an allowed variant
  for (const key of keys) if (!mapByKey.has(INVERSE[key])) buildMap(INVERSE[key])
  function buildMap(key: TKey) {
    const map = new Int32Array(n)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [sx, sy] = srcCoord(key, x, y, W, H)
        map[y * W + x] = sy * W + sx
      }
    }
    mapByKey.set(key, map)
  }

  // Extract each tile as a flat RGB float vector (edge pixels clamp-replicated).
  const tiles: Float32Array[] = new Array(P)
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const t = new Float32Array(n * 3)
      for (let ly = 0; ly < H; ly++) {
        for (let lx = 0; lx < W; lx++) {
          const gx = Math.min(tx * W + lx, width - 1)
          const gy = Math.min(ty * H + ly, height - 1)
          const c = px[gy * width + gx]
          const o = (ly * W + lx) * 3
          t[o] = c[0]
          t[o + 1] = c[1]
          t[o + 2] = c[2]
        }
      }
      tiles[ty * tilesX + tx] = t
    }
  }

  const round3 = (f: Float32Array): number[] => {
    const a = new Array<number>(n * 3)
    for (let i = 0; i < n * 3; i++) a[i] = Math.round(f[i])
    return a
  }

  // Natural unique count: canonical key = min serialisation over allowed transforms.
  const groupCount = new Map<string, number>()
  const groupRep = new Map<string, Float32Array>()
  const cellKey: string[] = new Array(P) // canonical key per cell
  const cellWin: TKey[] = new Array(P) // transform that canonicalised the cell
  for (let i = 0; i < P; i++) {
    const { key, rep, tkey } = canonical(tiles[i])
    cellKey[i] = key
    cellWin[i] = tkey
    groupCount.set(key, (groupCount.get(key) ?? 0) + 1)
    if (!groupRep.has(key)) groupRep.set(key, rep)
  }
  const naturalUnique = groupCount.size

  function canonical(tile: Float32Array): { key: string; rep: Float32Array; tkey: TKey } {
    let bestKey = ''
    let bestRep: Float32Array | null = null
    let bestT: TKey = 'id'
    for (const k of keys) {
      const map = mapByKey.get(k)!
      let s = ''
      const rep = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const src = map[i] * 3
        const r = tile[src]
        const g = tile[src + 1]
        const b = tile[src + 2]
        rep[i * 3] = r
        rep[i * 3 + 1] = g
        rep[i * 3 + 2] = b
        s += String.fromCharCode(r, g, b)
      }
      if (bestRep === null || s < bestKey) {
        bestKey = s
        bestRep = rep
        bestT = k
      }
    }
    return { key: bestKey, rep: bestRep!, tkey: bestT }
  }

  // No reduction needed — return as-is (with optional tilemap).
  if (opts.maxUniqueTiles <= 0 || naturalUnique <= opts.maxUniqueTiles) {
    let map: TileMapEntry[] | undefined
    let uniqueTiles: number[][] | undefined
    if (opts.collectMap) {
      const idxOf = new Map<string, number>()
      uniqueTiles = []
      map = new Array(P)
      for (let p = 0; p < P; p++) {
        let idx = idxOf.get(cellKey[p])
        if (idx === undefined) {
          idx = uniqueTiles.length
          idxOf.set(cellKey[p], idx)
          uniqueTiles.push(round3(groupRep.get(cellKey[p])!))
        }
        // cell = INVERSE[canonicalising transform] applied to the stored tile
        map[p] = { tile: idx, ...keyFlags(INVERSE[cellWin[p]]) }
      }
    }
    return { pixels: px, naturalUnique, uniqueCount: naturalUnique, tilesX, tilesY, map, uniqueTiles }
  }

  // ---- Transform-aware k-means to merge tiles down to the budget ----
  const k = opts.maxUniqueTiles
  const seeds = [...groupCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, k)
  const centroids: Float32Array[] = seeds.map((s) => groupRep.get(s[0])!.slice())

  // Per (centroid, transform) we precompute t_inv(centroid): comparing t(tile)
  // to centroid equals comparing tile to t_inv(centroid). The chosen variant is
  // ALSO the replacement pixels for the tile, so this does double duty.
  const variants: Float32Array[][] = centroids.map(() => keys.map(() => new Float32Array(n * 3)))

  const assignC = new Int32Array(P)
  const assignT = new Int32Array(P)

  function recomputeVariants() {
    for (let c = 0; c < centroids.length; c++) {
      for (let ti = 0; ti < keys.length; ti++) {
        const invMap = mapByKey.get(INVERSE[keys[ti]])!
        const dst = variants[c][ti]
        const cen = centroids[c]
        for (let i = 0; i < n; i++) {
          const src = invMap[i] * 3
          const o = i * 3
          dst[o] = cen[src]
          dst[o + 1] = cen[src + 1]
          dst[o + 2] = cen[src + 2]
        }
      }
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    recomputeVariants()
    const sums = centroids.map(() => new Float64Array(n * 3))
    const counts = new Int32Array(centroids.length)

    for (let p = 0; p < P; p++) {
      const tile = tiles[p]
      let bestC = 0
      let bestT = 0
      let bestD = Infinity
      for (let c = 0; c < centroids.length; c++) {
        for (let ti = 0; ti < keys.length; ti++) {
          const v = variants[c][ti]
          let d = 0
          for (let j = 0; j < n * 3; j++) {
            const diff = tile[j] - v[j]
            d += diff * diff
          }
          if (d < bestD) {
            bestD = d
            bestC = c
            bestT = ti
          }
        }
      }
      assignC[p] = bestC
      assignT[p] = bestT
      // accumulate t(tile) into centroid bestC using the forward map
      const fwd = mapByKey.get(keys[bestT])!
      const sum = sums[bestC]
      for (let i = 0; i < n; i++) {
        const src = fwd[i] * 3
        const o = i * 3
        sum[o] += tile[src]
        sum[o + 1] += tile[src + 1]
        sum[o + 2] += tile[src + 2]
      }
      counts[bestC]++
    }

    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] === 0) continue
      const sum = sums[c]
      const cen = centroids[c]
      for (let j = 0; j < n * 3; j++) cen[j] = sum[j] / counts[c]
    }
  }

  recomputeVariants()
  // Render: each tile becomes its chosen variant (= t_inv(centroid)).
  const out = px.slice()
  const used = new Set<number>()
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const p = ty * tilesX + tx
      used.add(assignC[p])
      const v = variants[assignC[p]][assignT[p]]
      for (let ly = 0; ly < H; ly++) {
        const gy = ty * H + ly
        if (gy >= height) break
        for (let lx = 0; lx < W; lx++) {
          const gx = tx * W + lx
          if (gx >= width) break
          const o = (ly * W + lx) * 3
          out[gy * width + gx] = [Math.round(v[o]), Math.round(v[o + 1]), Math.round(v[o + 2])]
        }
      }
    }
  }

  let map: TileMapEntry[] | undefined
  let uniqueTiles: number[][] | undefined
  if (opts.collectMap) {
    // compact used centroids to a dense index space
    const compact = new Map<number, number>()
    uniqueTiles = []
    for (const c of used) {
      compact.set(c, uniqueTiles.length)
      uniqueTiles.push(round3(centroids[c]))
    }
    map = new Array(P)
    for (let p = 0; p < P; p++) {
      // cell = INVERSE[keys[assignT]] applied to the stored centroid
      map[p] = { tile: compact.get(assignC[p])!, ...keyFlags(INVERSE[keys[assignT[p]]]) }
    }
  }

  return { pixels: out, naturalUnique, uniqueCount: used.size, tilesX, tilesY, map, uniqueTiles }
}
