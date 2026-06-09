# quantiseJS

Quantise images into Gen&nbsp;3 / Gen&nbsp;4 tile-console graphics (NES, Master System, Mega Drive, SNES) — a one-page Vite + React tool.

Load an image, pick a console preset, and the tool reduces it to a tile-based,
palette-limited image the way the real hardware would: a fixed colour gamut,
a handful of palettes with a limited number of colours each, an optional shared
background colour, and per-tile palette assignment.

## How it works

1. **Resize** the source to the output resolution.
2. **Colour-depth snap** every pixel to the console's gamut (NES fixed 54-colour
   palette; 2/3/5 bits per channel for SMS/Mega Drive/SNES).
3. **Partition** into tiles.
4. **Palette generation + assignment** — seed _N_ palettes by farthest-point
   sampling over tile averages, then run Lloyd iterations: assign each tile to
   its cheapest-error palette, rebuild each palette via median-cut from its
   members' pooled colours. Repeat.
5. **Render** each pixel to the nearest colour in its tile's palette.

## Develop

```bash
npm install
npm run dev      # http://localhost:5199
npm run build
```

## Presets

| Console | Colour space | Palettes × colours | Resolution |
| --- | --- | --- | --- |
| NES | fixed 54-colour PPU | 4 × 3 (+shared backdrop) | 256×240 |
| Master System | 2 bits/channel (64) | 1 × 16 | 256×192 |
| Mega Drive | 3 bits/channel (512) | 4 × 16 | 320×224 |
| SNES | 5 bits/channel (32768) | 8 × 16 | 256×224 |
| Custom | full 24-bit | your call | your call |
