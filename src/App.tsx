import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controls, type Settings } from './components/Controls'
import { CanvasView } from './components/CanvasView'
import { SourceView } from './components/SourceView'
import { PaletteView } from './components/PaletteView'
import { imageToImageData, loadImageFile } from './lib/image'
import type { QuantiseOptions, QuantiseResult } from './lib/quantise'
import type { WorkerRequest, WorkerResponse } from './lib/worker'
import { NEUTRAL_GRADE } from './lib/grade'
import { presetById, PRESETS } from './lib/presets'

function defaultSettings(): Settings {
  const p = PRESETS[0]
  return {
    presetId: p.id,
    palettes: p.palettes,
    colorsPerPalette: p.colorsPerPalette,
    maxColorsPerTile: p.maxColorsPerTile,
    sharedBg: p.sharedBg,
    tileWidth: p.tileSize,
    tileHeight: p.tileSize,
    width: p.width,
    height: p.height,
    attributeGrid: p.attributeGrid,
    maxUniqueTiles: p.maxUniqueTiles,
    flipH: p.flipH,
    flipV: p.flipV,
    rotate: false,
    shadow: p.shadow ?? false,
    highlight: p.highlight ?? false,
    downscale: 'nearest',
    fitMode: 'fill',
    dither: 'none',
    grade: { ...NEUTRAL_GRADE },
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [result, setResult] = useState<QuantiseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const fileName = useRef<string>('image')

  const preset = useMemo(() => presetById(settings.presetId), [settings.presetId])

  // Pipeline runs in a worker; only the latest request's result is applied.
  const workerRef = useRef<Worker | null>(null)
  const reqId = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./lib/worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== reqId.current) return // stale
      setResult({ imageData: e.data.imageData, palettes: e.data.palettes, stats: e.data.stats })
      setBusy(false)
    }
    workerRef.current = w
    return () => w.terminate()
  }, [])

  const run = useCallback(() => {
    const w = workerRef.current
    if (!img || !w) return
    setBusy(true)
    // Resize (needs canvas/DOM) on the main thread; grade + quantise in the worker.
    const input = imageToImageData(
      img,
      settings.width,
      settings.height,
      settings.downscale,
      settings.fitMode,
    )
    const opts: QuantiseOptions = {
      palettes: settings.palettes,
      colorsPerPalette: settings.colorsPerPalette,
      maxColorsPerTile: settings.maxColorsPerTile,
      sharedBg: settings.sharedBg,
      regionW: settings.attributeGrid ? settings.tileWidth * 2 : settings.tileWidth,
      regionH: settings.attributeGrid ? settings.tileHeight * 2 : settings.tileHeight,
      tileW: settings.tileWidth,
      tileH: settings.tileHeight,
      depth: preset.depth,
      dither: settings.dither,
      shadow: settings.shadow,
      highlight: settings.highlight,
      maxUniqueTiles: settings.maxUniqueTiles,
      flipH: settings.flipH,
      flipV: settings.flipV,
      rotate: settings.rotate,
    }
    const req: WorkerRequest = { id: ++reqId.current, imageData: input, grade: settings.grade, opts }
    w.postMessage(req)
  }, [img, settings, preset])

  // Auto-process whenever the image or settings change, debounced so dragging
  // sliders coalesces into a single run.
  useEffect(() => {
    if (!img) return
    const t = setTimeout(run, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, settings])

  const onFile = useCallback(async (file: File) => {
    fileName.current = file.name.replace(/\.[^.]+$/, '')
    const loaded = await loadImageFile(file)
    setImg(loaded)
  }, [])

  return (
    <div className="app">
      <header>
        <h1>
          quantise<span>JS</span>
        </h1>
      </header>

      <div className="layout">
        <Controls
          settings={settings}
          setSettings={setSettings}
          onFile={onFile}
          preset={preset}
          hasImage={!!img}
        />

        <main>
          <CanvasView
            img={img}
            result={result}
            fileName={fileName.current}
            busy={busy}
            maxUniqueTiles={settings.maxUniqueTiles}
            onMaxUnique={(n) => setSettings({ ...settings, maxUniqueTiles: n })}
          />
          {img && (
            <div className="bottom-row">
              <SourceView img={img} />
              {result && <PaletteView result={result} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
