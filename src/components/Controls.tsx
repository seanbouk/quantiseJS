import { type ChangeEvent } from 'react'
import { PRESETS, type Preset } from '../lib/presets'

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
    })
  }

  const num = (key: keyof Settings, min: number, max: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(min, Math.min(max, Number(e.target.value) || min))
    update({ [key]: v } as Partial<Settings>)
  }

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
        <div className="field">
          <label>tile size</label>
          <input type="number" min={1} max={64} value={settings.tileSize} onChange={num('tileSize', 1, 64)} />
        </div>
        <div className="field">
          <label>output width</label>
          <input type="number" min={8} max={1024} value={settings.width} onChange={num('width', 8, 1024)} />
        </div>
        <div className="field">
          <label>output height</label>
          <input type="number" min={8} max={1024} value={settings.height} onChange={num('height', 8, 1024)} />
        </div>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.sharedBg}
          onChange={(e) => update({ sharedBg: e.target.checked })}
        />
        Shared background colour (index 0)
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={settings.smooth}
          onChange={(e) => update({ smooth: e.target.checked })}
        />
        Box-filter downscale (off = nearest)
      </label>

      <button className="run" disabled={!hasImage || busy} onClick={onRun}>
        {busy ? 'Processing…' : 'Re-process'}
      </button>
    </aside>
  )
}
