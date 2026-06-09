import { type ChangeEvent } from 'react'
import { PRESETS, type Preset } from '../lib/presets'
import { Combo } from './Combo'
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
  attributeGrid: boolean
  maxUniqueTiles: number
  flipH: boolean
  flipV: boolean
  rotate: boolean
  shadow: boolean
  highlight: boolean
  // artistic / processing (not hardware-determined; persist across presets)
  smooth: boolean
  fitMode: FitMode
  dither: Dither
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

  // Switching console resets only the hardware-determined fields; the
  // processing options (scaling, dithering, filter) carry over deliberately.
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
      shadow: p.shadow ?? false,
      highlight: p.highlight ?? false,
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
        <legend>Resolution</legend>
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
      </fieldset>

      <fieldset>
        <legend>Palettes</legend>
        <div className="grid2">
          <div className="field">
            <label># palettes</label>
            <Combo
              value={settings.palettes}
              min={1}
              max={16}
              options={[1, 2, 3, 4, 8, 16]}
              onChange={(v) => update({ palettes: v })}
              ariaLabel="palettes"
            />
          </div>
          <div className="field">
            <label>colours / palette</label>
            <Combo
              value={settings.colorsPerPalette}
              min={2}
              max={256}
              options={[2, 4, 8, 16, 32, 64, 256]}
              onChange={(v) => update({ colorsPerPalette: v })}
              ariaLabel="colours per palette"
            />
          </div>
          <div className="field">
            <label>max colours / tile</label>
            <Combo
              value={settings.maxColorsPerTile}
              min={2}
              max={256}
              options={[2, 4, 8, 16, 32, 64, 256]}
              onChange={(v) => update({ maxColorsPerTile: v })}
              ariaLabel="max colours per tile"
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
        <div className="checks-row">
          <label className="check">
            <input type="checkbox" checked={settings.shadow} onChange={check('shadow')} />
            shadow
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.highlight} onChange={check('highlight')} />
            highlight
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Tiles</legend>
        <div className="grid2">
          <div className="field">
            <label>tile size</label>
            <Combo
              value={settings.tileSize}
              min={1}
              max={64}
              options={[2, 4, 8, 16, 32, 64]}
              onChange={(v) => update({ tileSize: v })}
              ariaLabel="tile size"
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

      <fieldset className="processing">
        <legend>Processing</legend>
        <p className="note">Artistic choices — kept when you switch console.</p>
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
        <div className="field">
          <label>dithering</label>
          <select value={settings.dither} onChange={(e) => update({ dither: e.target.value as Dither })}>
            <option value="none">None</option>
            <option value="bayer">Ordered (Bayer 8×8)</option>
            <option value="floyd">Floyd–Steinberg</option>
          </select>
        </div>
      </fieldset>

      <button className="run" disabled={!hasImage || busy} onClick={onRun}>
        {busy ? 'Processing…' : 'Re-process'}
      </button>
    </aside>
  )
}
