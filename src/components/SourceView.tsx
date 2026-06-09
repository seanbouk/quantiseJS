import { useEffect, useRef } from 'react'

export function SourceView({ img }: { img: HTMLImageElement }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const max = 220
    const scale = Math.min(max / img.width, max / img.height, 1)
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, c.width, c.height)
  }, [img])

  return (
    <figure className="source">
      <figcaption>Source</figcaption>
      <canvas ref={ref} />
    </figure>
  )
}
