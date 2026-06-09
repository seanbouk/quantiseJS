import type { RGB } from './color'

/**
 * How a console constrains the colour gamut:
 *  - none:  arbitrary 24-bit RGB (custom mode)
 *  - bits:  N bits per channel (SMS=2, Mega Drive=3, SNES=5)
 *  - fixed: a hardware-defined master palette (NES)
 */
export type DepthMode =
  | { kind: 'none' }
  | { kind: 'bits'; bits: number }
  | { kind: 'fixed'; palette: RGB[] }

export interface Preset {
  id: string
  name: string
  gen: 3 | 4 | 0
  palettes: number
  colorsPerPalette: number // total entries incl. shared index 0
  maxColorsPerTile: number
  sharedBg: boolean
  tileSize: number
  width: number
  height: number
  depth: DepthMode
  note?: string
}

// Classic NES (RP2C02) master palette — 64 entries, several duplicate blacks.
// Values are a widely-used approximation of the NTSC PPU output.
const NES_PALETTE: RGB[] = (
  [
    0x7c7c7c, 0x0000fc, 0x0000bc, 0x4428bc, 0x940084, 0xa80020, 0xa81000, 0x881400,
    0x503000, 0x007800, 0x006800, 0x005800, 0x004058, 0x000000, 0x000000, 0x000000,
    0xbcbcbc, 0x0078f8, 0x0058f8, 0x6844fc, 0xd800cc, 0xe40058, 0xf83800, 0xe45c10,
    0xac7c00, 0x00b800, 0x00a800, 0x00a844, 0x008888, 0x000000, 0x000000, 0x000000,
    0xf8f8f8, 0x3cbcfc, 0x6888fc, 0x9878f8, 0xf878f8, 0xf85898, 0xf87858, 0xfca044,
    0xf8b800, 0xb8f818, 0x58d854, 0x58f898, 0x00e8d8, 0x787878, 0x000000, 0x000000,
    0xfcfcfc, 0xa4e4fc, 0xb8b8f8, 0xd8b8f8, 0xf8b8f8, 0xf8a4c0, 0xf0d0b0, 0xfce0a8,
    0xf8d878, 0xd8f878, 0xb8f8b8, 0xb8f8d8, 0x00fcfc, 0xf8d8f8, 0x000000, 0x000000,
  ] as number[]
).map((v): RGB => [(v >> 16) & 255, (v >> 8) & 255, v & 255])

export const PRESETS: Preset[] = [
  {
    id: 'nes',
    name: 'NES (Gen 3)',
    gen: 3,
    palettes: 4,
    colorsPerPalette: 4, // 3 unique + shared backdrop
    maxColorsPerTile: 4,
    sharedBg: true,
    tileSize: 8,
    width: 256,
    height: 240,
    depth: { kind: 'fixed', palette: NES_PALETTE },
    note: 'Fixed 54-colour PPU palette, 4 palettes of 3 + shared backdrop.',
  },
  {
    id: 'sms',
    name: 'Master System (Gen 3)',
    gen: 3,
    palettes: 1,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: false,
    tileSize: 8,
    width: 256,
    height: 192,
    depth: { kind: 'bits', bits: 2 },
    note: '2 bits/channel (64 colours), one 16-colour background palette.',
  },
  {
    id: 'megadrive',
    name: 'Mega Drive (Gen 4)',
    gen: 4,
    palettes: 4,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 8,
    width: 320,
    height: 224,
    depth: { kind: 'bits', bits: 3 },
    note: '3 bits/channel (512 colours), 4 palettes of 16 (index 0 transparent).',
  },
  {
    id: 'snes',
    name: 'SNES (Gen 4)',
    gen: 4,
    palettes: 8,
    colorsPerPalette: 16,
    maxColorsPerTile: 16,
    sharedBg: true,
    tileSize: 8,
    width: 256,
    height: 224,
    depth: { kind: 'bits', bits: 5 },
    note: '5 bits/channel (32768 colours), up to 8 palettes of 16.',
  },
  {
    id: 'custom',
    name: 'Custom (no hardware limits)',
    gen: 0,
    palettes: 4,
    colorsPerPalette: 8,
    maxColorsPerTile: 8,
    sharedBg: false,
    tileSize: 8,
    width: 256,
    height: 240,
    depth: { kind: 'none' },
    note: 'Full 24-bit colour. Set every limit yourself.',
  },
]

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
