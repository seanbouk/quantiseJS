import { type ChangeEvent } from 'react'
import { PRESETS, type Preset } from '../lib/presets'
import type { FitMode } from '../lib/image'
import type { Dither } from '../lib/quantise'

export interface Settings {
  presetId: string
  palettes: number
  colorsPerPalette: number
  maxColorsPerTile: number
  sharedBg: boolean
  tileSize: number
  width: number
  height: number
  smooth: boolean
  fitMode: FitMode
  attributeGrid: boolean
  maxUniqueTiles: number
  flipH: boolean
  flipV: boolean
  rotate: boolean
  dither: Dither
  halfbright: boolean
  doublebright: boolean
}

interface Props {
  settings: Settings
  setSettings: (s: Settings) => void
  onFile: (f: File) => void
  preset: Preset
  busy: boolean
  hasImage: boolean
  onRun: () => void
}

export function Controls({ settings, setSettings, onFile, preset, busy, hasImage, onRun }: Props) {
  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch })

  const onPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    update({
      presetId: id,
      palettes: p.palettes,
      colorsPerPalette: p.colorsPerPalette,
      maxColorsPerTile: p.maxColorsPerTile,
      sharedBg: p.sharedBg,
      tileSize: p.tileSize,
      width: p.width,
      height: p.height,
      attributeGrid: p.attributeGrid,
      maxUniqueTiles: p.maxUniqueTiles,
      flipH: p.flipH,
      flipV: p.flipV,
      rotate: false,
    })
  }

  const num =
    (key: keyof Settings, min: number, max: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const v = Math.max(min, Math.min(max, Number(e.target.value) || min))
      update({ [key]: v } as Partial<Settings>)
    }

  const check = (key: keyof Settings) => (e: ChangeEvent<HTMLInputElement>) =>
    update({ [key]: e.target.checked } as Partial<Settings>)

  return (
    <aside className="controls">
      <label className="file">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <span>{hasImage ? 'Change image…' : 'Load image…'}</span>
      </label>

      <div className="field">
        <label>Console preset</label>
        <select value={settings.presetId} onChange={(e) => onPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {preset.note && <p className="note">{preset.note}</p>}
      </div>

      <fieldset>
        <legend>Output</legend>
        <div className="grid2">
          <div className="field">
            <label>width</label>
            <input type="number" min={8} max={1024} value={settings.width} onChange={num('width', 8, 1024)} />
          </div>
          <div className="field">
            <label>height</label>
            <input type="number" min={8} max={1024} value={settings.height} onChange={num('height', 8, 1024)} />
          </div>
        </div>
        <div className="field">
          <label>scaling</label>
          <select value={settings.fitMode} onChange={(e) => update({ fitMode: e.target.value as FitMode })}>
            <option value="stretch">Stretch (fill frame, distort)</option>
            <option value="fit">Fit (letterbox, keep aspect)</option>
            <option value="fill">Fill (cover + crop, keep aspect)</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.smooth} onChange={check('smooth')} />
          Box-filter downscale (off = nearest)
        </label>
      </fieldset>

      <fieldset>
        <legend>Palettes</legend>
        <div className="grid2">
          <div className="field">
            <label># palettes</label>
            <input type="number" min={1} max={16} value={settings.palettes} onChange={num('palettes', 1, 16)} />
          </div>
          <div className="field">
            <label>colours / palette</label>
            <input
              type="number"
              min={2}
              max={256}
              value={settings.colorsPerPalette}
              onChange={num('colorsPerPalette', 2, 256)}
            />
          </div>
          <div className="field">
            <label>max colours / tile</label>
            <input
              type="number"
              min={2}
              max={256}
              value={settings.maxColorsPerTile}
              onChange={num('maxColorsPerTile', 2, 256)}
            />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.sharedBg} onChange={check('sharedBg')} />
          Shared background colour (index 0)
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.attributeGrid} onChange={check('attributeGrid')} />
          Attribute grid (palette per 2×2 tiles)
        </label>
      </fieldset>

      <fieldset>
        <legend>Tiles</legend>
        <div className="grid2">
          <div className="field">
            <label>tile size</label>
            <input type="number" min={1} max={64} value={settings.tileSize} onChange={num('tileSize', 1, 64)} />
          </div>
          <div className="field">
            <label>max unique (0=∞)</label>
            <input
              type="number"
              min={0}
              max={8192}
              value={settings.maxUniqueTiles}
              onChange={num('maxUniqueTiles', 0, 8192)}
            />
          </div>
        </div>
        <div className="checks-row">
          <label className="check">
            <input type="checkbox" checked={settings.flipH} onChange={check('flipH')} />
            flip H
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.flipV} onChange={check('flipV')} />
            flip V
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.rotate} onChange={check('rotate')} />
            rotate 90°
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Effects</legend>
        <div className="field">
          <label>dithering</label>
          <select value={settings.dither} onChange={(e) => update({ dither: e.target.value as Dither })}>
            <option value="none">None</option>
            <option value="bayer">Ordered (Bayer 8×8)</option>
            <option value="floyd">Floyd–Steinberg</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={settings.halfbright} onChange={check('halfbright')} />
          Half-bright (shadow ×0.5)
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.doublebright} onChange={check('doublebright')} />
          Double-bright (highlight ×1.5)
        </label>
      </fieldset>

      <button className="run" disabled={!hasImage || busy} onClick={onRun}>
        {busy ? 'Processing…' : 'Re-process'}
      </button>
    </aside>
  )
}
