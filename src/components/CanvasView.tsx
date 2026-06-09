import { useEffect, useRef } from 'react'
import type { QuantiseResult } from '../lib/quantise'

interface Props {
  img: HTMLImageElement | null
  result: QuantiseResult | null
  fileName: string
  busy: boolean
}

export function CanvasView({ img, result, fileName, busy }: Props) {
  const outRef = useRef<HTMLCanvasElement>(null)

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
    <figure className="quantised">
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
          <button className="dl" onClick={download}>
            Download PNG
          </button>
        </div>
      )}
    </figure>
  )
}
