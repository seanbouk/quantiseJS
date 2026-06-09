import { rgbToHex } from '../lib/color'
import type { QuantiseResult } from '../lib/quantise'

export function PaletteView({ result }: { result: QuantiseResult }) {
  return (
    <div className="palettes">
      <h2>Palettes</h2>
      {result.palettes.map((pal, i) => (
        <div className="palette-row" key={i}>
          <span className="palette-label">P{i}</span>
          <div className="swatches">
            {pal.map((c, j) => (
              <span
                key={j}
                className="swatch"
                title={rgbToHex(c)}
                style={{ background: rgbToHex(c) }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
