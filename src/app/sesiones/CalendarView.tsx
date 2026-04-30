'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarDayData {
  date: string;  // YYYY-MM-DD
  citas: number;
  ingresoEsperado: number;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getColorClass(ingreso: number): string {
  if (ingreso === 0) return 'bg-secondary/30 border-border/30'
  if (ingreso <= 5000) return 'bg-red-900/40 border-red-700/40'
  if (ingreso <= 10000) return 'bg-orange-900/40 border-orange-700/40'
  if (ingreso <= 14999) return 'bg-yellow-900/40 border-yellow-600/40'
  return 'bg-emerald-900/50 border-emerald-600/40'
}

function getTextColor(ingreso: number): string {
  if (ingreso === 0) return 'text-muted-foreground/50'
  if (ingreso <= 5000) return 'text-red-400'
  if (ingreso <= 10000) return 'text-orange-400'
  if (ingreso <= 14999) return 'text-yellow-400'
  return 'text-emerald-400'
}

function getDotColor(ingreso: number): string {
  if (ingreso === 0) return ''
  if (ingreso <= 5000) return 'bg-red-500'
  if (ingreso <= 10000) return 'bg-orange-500'
  if (ingreso <= 14999) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function fmt(val: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val)
}

interface CalendarViewProps {
  data: CalendarDayData[];
  selectedDay: string | null;
  onDayClick: (dateKey: string | null) => void;
}

export default function CalendarView({ data, selectedDay, onDayClick }: CalendarViewProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const dataMap: Record<string, CalendarDayData> = {}
  for (const d of data) {
    dataMap[d.date] = d
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    onDayClick(null)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    onDayClick(null)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); onDayClick(null) }

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: { day: number; inMonth: boolean; dateKey: string }[] = []

  const prevMonthLast = new Date(year, month, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLast - i
    const m = month === 0 ? 12 : month
    const y = month === 0 ? year - 1 : year
    cells.push({ day: d, inMonth: false, dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, inMonth: true, dateKey })
  }

  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2
      const y = month === 11 ? year + 1 : year
      cells.push({ day: d, inMonth: false, dateKey: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
  }

  let monthCitas = 0, monthIngreso = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const info = dataMap[key]
    if (info) { monthCitas += info.citas; monthIngreso += info.ingresoEsperado }
  }

  const isToday = (dateKey: string) => {
    const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return dateKey === t
  }

  const handleDayClick = (dateKey: string) => {
    onDayClick(selectedDay === dateKey ? null : dateKey)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft size={20} />
          </button>
          <h4 className="text-lg font-semibold min-w-[180px] text-center">
            {MESES[month]} {year}
          </h4>
          <button onClick={nextMonth} className="p-2 rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight size={20} />
          </button>
          <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-2">
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {selectedDay && (
            <button
              onClick={() => onDayClick(null)}
              className="text-xs px-3 py-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
            >
              Ver todo el período
            </button>
          )}
          <span>{monthCitas} citas</span>
          <span className="font-medium text-foreground">{fmt(monthIngreso)}</span>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-secondary/30 border border-border/30"></span>$0</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-900/40 border border-red-700/40"></span>$1-$5k</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-900/40 border border-orange-700/40"></span>$5k-$10k</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-900/40 border border-yellow-600/40"></span>$10k-$15k</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-900/50 border border-emerald-600/40"></span>$15k+</span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          const info = dataMap[cell.dateKey]
          const ingreso = info?.ingresoEsperado || 0
          const citas = info?.citas || 0
          const today = isToday(cell.dateKey)
          const isSelected = selectedDay === cell.dateKey

          if (!cell.inMonth) {
            return (
              <div key={idx} className="rounded-lg p-2 min-h-[80px] bg-secondary/10 border border-transparent opacity-30">
                <span className="text-xs text-muted-foreground">{cell.day}</span>
              </div>
            )
          }

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(cell.dateKey)}
              className={`rounded-lg p-2 min-h-[80px] border transition-all hover:scale-[1.02] cursor-pointer ${getColorClass(ingreso)} ${
                isSelected
                  ? 'ring-2 ring-white ring-offset-1 ring-offset-background scale-[1.02]'
                  : today
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                    : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${isSelected ? 'text-white' : today ? 'text-primary' : 'text-foreground'}`}>
                  {cell.day}
                </span>
                {citas > 0 && <span className={`w-2 h-2 rounded-full ${getDotColor(ingreso)}`}></span>}
              </div>
              {citas > 0 ? (
                <div className="space-y-0.5">
                  <p className={`text-xs font-medium ${getTextColor(ingreso)}`}>{citas} cita{citas > 1 ? 's' : ''}</p>
                  <p className={`text-xs font-bold ${getTextColor(ingreso)}`}>{fmt(ingreso)}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/30 mt-1">—</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
