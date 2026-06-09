import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  options: number[]
  min: number
  max: number
  onChange: (n: number) => void
  ariaLabel?: string
}

/**
 * Numeric combobox: a text field (free entry, numeric) plus a dropdown that
 * always shows the full option list. Unlike a native <datalist>, options are
 * not filtered by the current value.
 */
export function Combo({ value, options, min, max, onChange, ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null) // non-null while editing
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const commit = (raw: string) => {
    onChange(Math.max(min, Math.min(max, Number(raw) || min)))
    setText(null)
  }

  const display = text ?? String(value)

  return (
    <div className="combo-wrap" ref={wrapRef}>
      <input
        type="text"
        inputMode="numeric"
        className="combo"
        aria-label={ariaLabel}
        value={display}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(display)
            setOpen(false)
          } else if (e.key === 'Escape') {
            setText(null)
            setOpen(false)
          }
        }}
        onBlur={() => {
          if (text !== null) commit(text)
        }}
      />
      {open && (
        <ul className="combo-list">
          {options.map((o) => (
            <li
              key={o}
              className={o === value ? 'sel' : ''}
              // mousedown (not click) so it fires before the input's blur
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(o)
                setText(null)
                setOpen(false)
              }}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
