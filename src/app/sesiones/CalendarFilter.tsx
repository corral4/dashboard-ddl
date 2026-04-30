'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function CalendarFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const current = searchParams.get('cal') || 'all'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (val === 'all') {
      params.delete('cal')
    } else {
      params.set('cal', val)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm outline-none text-foreground"
    >
      <option value="all">Ambos Calendarios</option>
      <option value="cal1">Calendario 1</option>
      <option value="cal2">Calendario 2</option>
    </select>
  )
}
