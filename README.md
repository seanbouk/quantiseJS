# quantiseJS

Quantise images into tile-based retro-console graphics — a one-page Vite + React + TypeScript tool.

Load an image, pick a console preset, and quantiseJS reduces it the way the real
hardware would: a fixed colour gamut, a handful of palettes with limited colours
each, an optional shared background colour, per-tile palette assignment, and a
cap on the number of unique tiles. Colour grading and dithering let you push the
result toward something *designed* rather than merely digitised.

## Develop

```bash
npm install
npm run dev      # http://localhost:5199
npm run build
```

The grade → quantise → tile-dedup pipeline runs in a **web worker**, so the UI
never blocks during heavy work (tile-reduction or blue-noise generation).

## Pipeline

1. **Colour grade** the source (brightness gain, contrast, saturation,
   blue↔yellow temperature, green↔magenta tint, hue rotation).
2. **Resize** to the output resolution (nearest / smooth / high-quality smooth;
   stretch / fit / fill).
3. **Colour-depth snap** every pixel to the console gamut (NES & Game Boy use
   fixed master palettes; others use N bits per channel).
4. **Partition** into palette regions (and a separate tile grid for dedup).
5. **Palette generation + assignment** — seed _N_ palettes by farthest-point
   sampling over region averages, then run Lloyd iterations: assign each region
   to its cheapest-error palette and rebuild each palette via median-cut from its
   members' pooled colours.
6. **Render** each pixel to the nearest colour in its region's palette, with
   optional dithering.
7. **Tile dedup** — collapse tiles that are equal under H/V flip (and optional
   90° rotation on square tiles), then, if over the unique-tile budget, merge the
   closest tiles via transform-aware k-means.

## Presets

| Console | Colour space | Palettes × colours | Resolution |
| --- | --- | --- | --- |
| NES / Famicom | fixed 54-colour PPU | 4 × 3 (+shared backdrop) | 256×240 |
| Game Boy (DMG) | fixed 4-green LCD | 1 × 4 | 160×144 |
| Master System | 2 bits/channel (64) | 1 × 16 | 256×192 |
| Game Gear | 4 bits/channel (4096) | 2 × 16 | 160×144 |
| PC Engine / TG-16 | 3 bits/channel (512) | 16 × 16 | 256×224 |
| Game Boy Color | 5 bits/channel | 8 × 4 | 160×144 |
| Mega Drive / Genesis | 3 bits/channel (512) | 4 × 16 | 320×224 |
| Neo Geo | ~15-bit | 16 × 16 (16px tiles) | 320×224 |
| SNES / Super Famicom | 5 bits/channel (32768) | 8 × 16 | 256×224 |
| Game Boy Advance | 5 bits/channel | 16 × 16 | 240×160 |
| Sharp X68000 | ~16-bit | 16 × 16 | 256×256 |
| Custom | full 24-bit | your call | your call |

Per-console hardware quirks are baked in: NES, Game Boy (DMG) and PC Engine
backgrounds can't flip; NES assigns one palette per 16×16 attribute block; each
console has a sensible unique-tile budget. **Hardware** settings reset when you
switch console; **Processing** and **Colour grade** (artistic choices) carry over.

## Controls

- **Resolution** — output width/height.
- **Palettes** — number of palettes, colours per palette, max colours per tile,
  shared background colour, NES attribute grid, and Mega Drive **shadow** (×0.5)
  / **highlight** (×1.5) modes.
- **Tiles** — tile width × height (square or oblong, e.g. full-width strips),
  H/V flip, 90° rotate, and a **max unique tiles** slider under the image
  (drag left to reduce, right for no reduction up to the natural count).
- **Processing** — downscale filter, scaling mode, dithering.
- **Colour grade** — brightness, contrast, saturation, blue↔yellow, green↔magenta, hue.

### Dithering

- **Ordered** — Bayer 2×2 / 4×4 / 8×8, clustered-dot halftone, blue noise
  (void-and-cluster), and vertical / horizontal / diagonal line screens.
- **Error diffusion** — Floyd–Steinberg, False Floyd–Steinberg,
  Jarvis–Judice–Ninke, Stucki, Atkinson, Burkes, Sierra (3-row / 2-row / Lite).
- **Stochastic** — white noise.

## Export

- **Download PNG** — the final quantised image.
- **Export tiles** — an engine-agnostic bundle:
  - `<name>-tiles.png` — the unique tiles laid out in a sheet (flip-aware).
  - `<name>.json` — palettes (hex), each unique tile as palette-relative index
    grids, and a row-major tilemap (`{ t, p, fx, fy, rot }` per cell).
