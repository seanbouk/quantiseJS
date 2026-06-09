import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

export interface SelectGroup {
  label?: string
  options: { value: string; label: string }[]
}

interface Props {
  value: string
  groups: SelectGroup[]
  onChange: (v: string) => void
  ariaLabel?: string
}

/**
 * Custom grouped dropdown. Unlike a native <select>, the popup height is ours
 * to control (so a long list shows lots before scrolling).
 */
export function SelectMenu({ value, groups, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Keep the popup within the viewport: cap its height to the available space,
  // and open upward when there's more room above than below.
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const measure = () => {
      const rect = wrapRef.current!.getBoundingClientRect()
      const margin = 12
      const below = window.innerHeight - rect.bottom - margin
      const above = rect.top - margin
      // open toward whichever side has more room, and use all of it
      const up = above > below
      const maxHeight = Math.max(140, Math.floor(up ? above : below))
      setMenuStyle(
        up
          ? { top: 'auto', bottom: 'calc(100% + 2px)', maxHeight }
          : { top: 'calc(100% + 2px)', bottom: 'auto', maxHeight },
      )
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const current = groups.flatMap((g) => g.options).find((o) => o.value === value)

  return (
    <div className="combo-wrap" ref={wrapRef}>
      <button
        type="button"
        className="combo select-trigger"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.label ?? value}
      </button>
      {open && (
        <ul className="combo-list" style={menuStyle}>
          {groups.map((g, gi) => (
            <Fragment key={gi}>
              {g.label && <li className="grp-label">{g.label}</li>}
              {g.options.map((o) => (
                <li
                  key={o.value}
                  className={o.value === value ? 'sel' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
