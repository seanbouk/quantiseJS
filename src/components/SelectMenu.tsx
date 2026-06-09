import { Fragment, useEffect, useRef, useState } from 'react'

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
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
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
        <ul className="combo-list">
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
