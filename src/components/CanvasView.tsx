import { useEffect, useRef } from 'react'
import type { QuantiseResult } from '../lib/quantise'

interface Props {
  img: HTMLImageElement | null
  result: QuantiseResult | null
  fileName: string
  busy: boolean
}

export function CanvasView({ img, result, fileName, busy }: Props) {
  const origRef = useRef<HTMLCanvasElement>(null)
  const outRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = origRef.current
    if (!c || !img) return
    const max = 320
    const scale = Math.min(max / img.width, max / img.height, 1)
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, c.width, c.height)
  }, [img])

  useEffect(() => {
    const c = outRef.current
    if (!c || !result) return
    c.width = result.stats.width
    c.height = result.stats.height
    c.getContext('2d')!.putImageData(result.imageData, 0, 0)
  }, [result])

  const download = () => {
    const c = outRef.current
    if (!c) return
    const a = document.createElement('a')
    a.download = `${fileName}-quantised.png`
    a.href = c.toDataURL('image/png')
    a.click()
  }

  if (!img) {
    return (
      <div className="canvas-empty">
        <p>Load an image to begin.</p>
      </div>
    )
  }

  return (
    <div className="canvas-grid">
      <figure>
        <figcaption>Source</figcaption>
        <canvas ref={origRef} />
      </figure>
      <figure>
        <figcaption>
          Quantised
          {result && (
            <span className="dims">
              {result.stats.width}×{result.stats.height}
            </span>
          )}
        </figcaption>
        <div className="out-wrap" data-busy={busy}>
          <canvas ref={outRef} className="pixelated" />
        </div>
        {result && (
          <button className="dl" onClick={download}>
            Download PNG
          </button>
        )}
      </figure>

      {result && (
        <div className="stats">
          <span>
            <b>{result.stats.tilesX * result.stats.tilesY}</b> tiles ({result.stats.tilesX}×
            {result.stats.tilesY})
          </span>
          <span>
            <b>{result.stats.uniqueTiles}</b> unique tiles
            {result.stats.uniqueTiles !== result.stats.naturalUniqueTiles && (
              <em> (from {result.stats.naturalUniqueTiles})</em>
            )}
          </span>
          <span>
            <b>{result.stats.palettesUsed}</b> palettes used
          </span>
          <span>
            <b>{result.stats.uniqueColorsOut}</b> unique colours
          </span>
        </div>
      )}
    </div>
  )
}
