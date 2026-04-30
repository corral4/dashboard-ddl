'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function PeriodSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const currentPeriod = searchParams.get('period') || 'YTD'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (newPeriod === 'YTD') {
      params.delete('period')
    } else {
      params.set('period', newPeriod)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select 
      value={currentPeriod}
      onChange={handleChange}
      className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm outline-none text-foreground"
    >
      <option value="YTD">Acumulado YTD</option>
      <option value="CURRENT_MONTH">Este mes</option>
      <option value="ALL_YEAR">Todo el año</option>
      <option disabled>──────────</option>
      <option value="MONTH_0">Enero</option>
      <option value="MONTH_1">Febrero</option>
      <option value="MONTH_2">Marzo</option>
      <option value="MONTH_3">Abril</option>
      <option value="MONTH_4">Mayo</option>
      <option value="MONTH_5">Junio</option>
      <option value="MONTH_6">Julio</option>
      <option value="MONTH_7">Agosto</option>
      <option value="MONTH_8">Septiembre</option>
      <option value="MONTH_9">Octubre</option>
      <option value="MONTH_10">Noviembre</option>
      <option value="MONTH_11">Diciembre</option>
    </select>
  )
}
