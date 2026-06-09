import { useEffect, useRef, useState } from 'react'
import type { QuantiseResult } from '../lib/quantise'

interface Props {
  img: HTMLImageElement | null
  result: QuantiseResult | null
  fileName: string
  busy: boolean
  maxUniqueTiles: number
  onMaxUnique: (n: number) => void
}

/** Slider for the unique-tile budget. Max = the natural unique-tile count;
 *  dragging fully right (== natural) means "no reduction" (stored as 0). */
function TileSlider({
  value,
  natural,
  onCommit,
}: {
  value: number
  natural: number
  onCommit: (n: number) => void
}) {
  const [drag, setDrag] = useState<number | null>(null)
  const max = Math.max(1, natural)
  const shown = Math.min(drag ?? value, max)
  const commit = (v: number) => {
    onCommit(v >= max ? 0 : v)
    setDrag(null)
  }
  return (
    <div className="tile-slider">
      <label>max unique tiles</label>
      <input
        type="range"
        min={1}
        max={max}
        value={shown}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
      />
      <span className="val">
        {shown} / {natural}
      </span>
    </div>
  )
}

export function CanvasView({ img, result, fileName, busy, maxUniqueTiles, onMaxUnique }: Props) {
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

  const natural = result?.stats.naturalUniqueTiles ?? 0
  const sliderValue = maxUniqueTiles === 0 ? natural : Math.min(maxUniqueTiles, natural)

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
        <>
          <TileSlider value={sliderValue} natural={natural} onCommit={onMaxUnique} />
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
        </>
      )}
    </figure>
  )
}
