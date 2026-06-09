import type { RGB } from './color'

/**
 * How a console constrains the colour gamut:
 *  - none:  arbitrary 24-bit RGB (custom mode)
 *  - bits:  N bits per channel (SMS=2, Mega Drive/PCE=3, Game Gear=4, SNES=5)
 *  - fixed: a hardware-defined master palette (NES, Game Boy)
 */
export type DepthMode =
  | { kind: 'none' }
  | { kind: 'bits'; bits: number }
  | { kind: 'fixed'; palette: RGB[] }

export interface Preset {
  id: string
  name: string
  palettes: number
  colorsPerPalette: number // total entries incl. shared index 0
  maxColorsPerTile: number
  sharedBg: boolean
  tileSize: number
  width: number
  height: number
  depth: DepthMode
  // tile / hardware-quirk defaults
  attributeGrid: boolean // assign palette per 2x2 tile block (NES)
  maxUniqueTiles: number // 0 = unlimited
  flipH: boolean
  flipV: boolean
  note?: string
}

const packPalette = (hex: number[]): RGB[] =>
  hex.map((v): RGB => [(v >> 16) & 255, (v >> 8) & 255, v & 255])

// Classic NES (RP2C02) master palette — 64 entries, several duplicate blacks.
// A widely-used approximation of the NTSC PPU output.
const NES_PALETTE = packPalette([
  0x7c7c7c, 0x0000fc, 0x0000bc, 0x4428bc, 0x940084, 0xa80020, 0xa81000, 0x881400,
  0x503000, 0x007800, 0x006800, 0x005800, 0x004058, 0x000000, 0x000000, 0x000000,
  0xbcbcbc, 0x0078f8, 0x0058f8, 0x6844fc, 0xd800cc, 0xe40058, 0xf83800, 0xe45c10,
  0xac7c00, 0x00b800, 0x00a800, 0x00a844, 0x008888, 0x000000, 0x000000, 0x000000,
  0xf8f8f8, 0x3cbcfc, 0x6888fc, 0x9878f8, 0xf878f8, 0xf85898, 0xf87858, 0xfca044,
  0xf8b800, 0xb8f818, 0x58d854, 0x58f898, 0x00e8d8, 0x787878, 0x000000, 0x000000,
  0xfcfcfc, 0xa4e4fc, 0xb8b8f8, 0xd8b8f8, 0xf8b8f8, 0xf8a4c0, 0xf0d0b0, 0xfce0a8,
  0xf8d878, 0xd8f878, 0xb8f8b8, 0xb8f8d8, 0x00fcfc, 0xf8d8f8, 0x000000, 0x000000,
])

// Original Game Boy (DMG) greenish LCD, 4 shades light -> dark.
const DMG_PALETTE = packPalette([0x9bbc0f, 0x8bac0f, 0x306230, 0x0f380f])

export const PRESETS: Preset[] = [
  {
    id: 'nes',
    name: 'NES / Famicom',
    palettes: 4,
    colorsPerPalette: 4, // 3 unique + shared backdrop
    maxColorsPerTile: 4,
    sharedBg: true,
    tileSize: 8,
    width: 256,
    height: 240,
    depth: { kind: 'fixed', palette: NES_PALETTE },
    attributeGrid: true,
    maxUniqueTiles: 256,
    flipH: false, // NES background tiles cannot flip (sprites only)
    flipV: false,
    note: 'Fixed 54-colour PPU palette, 4 palettes of 3 + shared backdrop. Palette per 16×16 attribute block; BG tiles cannot flip.',
  },
  {
    id: 'gameboy',
    name: 'Game Boy (DMG)',
    palettes: 1,
    colorsPerPalette: 4,
    maxColorsPerTile: 4,
    sharedBg: false,
    tileSize: 8,
    width: 160,
    height: 144,
    depth: { kind: 'fixed', palette: DMG_PALETTE },
    attributeGrid: false,
    maxUniqueTiles: 256,
    flipH: false, // DMG background tiles can't flip (CGB added it)
    flipV: false,
    note: '4 shades of green, one palette. BG tiles cannot flip on DMG.',
  },
  {
    id: 'sms',
    name: 'Master System',
    palettes: 1,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: false,
    tileSize: 8,
    width: 256,
    height: 192,
    depth: { kind: 'bits', bits: 2 },
    attributeGrid: false,
    maxUniqueTiles: 448,
    flipH: true,
    flipV: true,
    note: '2 bits/channel (64 colours), one 16-colour background palette.',
  },
  {
    id: 'gamegear',
    name: 'Game Gear',
    palettes: 2,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: false,
    tileSize: 8,
    width: 160,
    height: 144,
    depth: { kind: 'bits', bits: 4 },
    attributeGrid: false,
    maxUniqueTiles: 448,
    flipH: true,
    flipV: true,
    note: 'Master System core but 4 bits/channel (4096 colours), 32 on screen.',
  },
  {
    id: 'pcengine',
    name: 'PC Engine / TurboGrafx-16',
    palettes: 16,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 8,
    width: 256,
    height: 224,
    depth: { kind: 'bits', bits: 3 },
    attributeGrid: false,
    maxUniqueTiles: 2048,
    flipH: false, // PCE BAT has no flip bits
    flipV: false,
    note: '3 bits/channel (512 colours), 16 BG palettes of 16. No tile flipping.',
  },
  {
    id: 'gbc',
    name: 'Game Boy Color',
    palettes: 8,
    colorsPerPalette: 4,
    maxColorsPerTile: 4,
    sharedBg: false,
    tileSize: 8,
    width: 160,
    height: 144,
    depth: { kind: 'bits', bits: 5 },
    attributeGrid: false,
    maxUniqueTiles: 512, // two VRAM banks
    flipH: true,
    flipV: true,
    note: '5 bits/channel (32768), 8 BG palettes of 4. Tile flipping supported.',
  },
  {
    id: 'megadrive',
    name: 'Mega Drive / Genesis',
    palettes: 4,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 8,
    width: 320,
    height: 224,
    depth: { kind: 'bits', bits: 3 },
    attributeGrid: false,
    maxUniqueTiles: 1500,
    flipH: true,
    flipV: true,
    note: '3 bits/channel (512 colours), 4 palettes of 16. Try shadow/highlight (half/double bright).',
  },
  {
    id: 'neogeo',
    name: 'Neo Geo',
    palettes: 16,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 16,
    width: 320,
    height: 224,
    depth: { kind: 'bits', bits: 5 },
    attributeGrid: false,
    maxUniqueTiles: 4096,
    flipH: true,
    flipV: true,
    note: 'Sprite-composed (16×16 tiles), ~15-bit colour, up to 4096 on screen.',
  },
  {
    id: 'snes',
    name: 'SNES / Super Famicom',
    palettes: 8,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 8,
    width: 256,
    height: 224,
    depth: { kind: 'bits', bits: 5 },
    attributeGrid: false,
    maxUniqueTiles: 1024,
    flipH: true,
    flipV: true,
    note: '5 bits/channel (32768 colours), up to 8 palettes of 16.',
  },
  {
    id: 'gba',
    name: 'Game Boy Advance',
    palettes: 16,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: false,
    tileSize: 8,
    width: 240,
    height: 160,
    depth: { kind: 'bits', bits: 5 },
    attributeGrid: false,
    maxUniqueTiles: 1024,
    flipH: true,
    flipV: true,
    note: '5 bits/channel (32768), 4bpp tiled mode: 16 palettes of 16.',
  },
  {
    id: 'x68000',
    name: 'Sharp X68000',
    palettes: 16,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: false,
    tileSize: 8,
    width: 256,
    height: 256,
    depth: { kind: 'bits', bits: 5 },
    attributeGrid: false,
    maxUniqueTiles: 1024,
    flipH: true,
    flipV: true,
    note: 'Home computer with a console-grade PCG tile/sprite layer: ~16-bit colour, 16 palettes of 16, H/V flip.',
  },
  {
    id: 'custom',
    name: 'Custom (no hardware limits)',
    palettes: 4,
    colorsPerPalette: 8,
    maxColorsPerTile: 8,
    sharedBg: false,
    tileSize: 8,
    width: 256,
    height: 240,
    depth: { kind: 'none' },
    attributeGrid: false,
    maxUniqueTiles: 0,
    flipH: true,
    flipV: true,
    note: 'Full 24-bit colour. Set every limit yourself.',
  },
]

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
