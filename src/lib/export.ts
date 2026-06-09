// Build an engine-agnostic export bundle from a quantise result:
//   <name>-tiles.png : the unique tiles laid out in a sheet (RGB)
//   <name>.json      : palettes + per-tile palette-relative indices + tilemap
import { nearestIndex, rgbToHex, type RGB } from './color'
import type { ExportData } from './quantise'

function triggerDownload(name: string, href: string) {
  const a = document.createElement('a')
  a.download = name
  a.href = href
  a.click()
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  triggerDownload(name, url)
  URL.revokeObjectURL(url)
}

export function buildExport(fileName: string, palettes: RGB[][], data: ExportData) {
  const { tileW, tileH, uniqueTiles, map, cellPalette, tilesX, tilesY } = data
  const N = uniqueTiles.length

  // 1. Tile-sheet PNG — unique tiles in a square-ish grid.
  const cols = Math.max(1, Math.ceil(Math.sqrt(N)))
  const rows = Math.ceil(N / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * tileW
  canvas.height = rows * tileH
  const ctx = canvas.getContext('2d')!
  const sheet = ctx.createImageData(canvas.width, canvas.height)
  uniqueTiles.forEach((tile, t) => {
    const ox = (t % cols) * tileW
    const oy = Math.floor(t / cols) * tileH
    for (let y = 0; y < tileH; y++) {
      for (let x = 0; x < tileW; x++) {
        const si = (y * tileW + x) * 3
        const di = ((oy + y) * canvas.width + (ox + x)) * 4
        sheet.data[di] = tile[si]
        sheet.data[di + 1] = tile[si + 1]
        sheet.data[di + 2] = tile[si + 2]
        sheet.data[di + 3] = 255
      }
    }
  })
  ctx.putImageData(sheet, 0, 0)
  triggerDownload(`${fileName}-tiles.png`, canvas.toDataURL('image/png'))

  // 2. JSON — palette of each unique tile = palette of the first cell using it.
  const tilePalette = new Array<number>(N).fill(0)
  const seen = new Array<boolean>(N).fill(false)
  map.forEach((m, cell) => {
    if (!seen[m.tile]) {
      seen[m.tile] = true
      tilePalette[m.tile] = cellPalette[cell]
    }
  })

  const tiles = uniqueTiles.map((tile, t) => {
    const pal = palettes[tilePalette[t]] ?? palettes[0]
    const indices: number[][] = []
    for (let y = 0; y < tileH; y++) {
      const row: number[] = []
      for (let x = 0; x < tileW; x++) {
        const si = (y * tileW + x) * 3
        row.push(nearestIndex([tile[si], tile[si + 1], tile[si + 2]], pal))
      }
      indices.push(row)
    }
    return { palette: tilePalette[t], indices }
  })

  const json = {
    meta: { tileW, tileH, tilesX, tilesY, uniqueTiles: N, palettes: palettes.length },
    palettes: palettes.map((p) => p.map(rgbToHex)),
    tiles,
    map: map.map((m, cell) => ({
      t: m.tile,
      p: cellPalette[cell],
      fx: m.fx,
      fy: m.fy,
      rot: m.rot,
    })),
  }
  downloadText(`${fileName}.json`, JSON.stringify(json))
}
