'use client'

import { useState, useMemo } from 'react'
import CalendarView from './CalendarView'

// Types duplicated from service (can't import server types in client)
interface SesionCita {
  fecha: string;
  horaInicio: string;
  horaFinal: string;
  titulo: string;
  paqueteNum: string;
  paqueteNombre: string;
  precioEsperado: number;
  realizada: boolean;
  cancelada: boolean;
  calendario: 'cal1' | 'cal2';
}

interface PaqueteConversion {
  paquete: string;
  citasAgendadas: number;
  sesionesReales: number;
  conversionPct: number;
  ingresoEsperado: number;
  ingresoReal: number;
  diferencia: number;
}

interface CalendarDayData {
  date: string;
  citas: number;
  ingresoEsperado: number;
}

interface SesionesContentProps {
  metrics: {
    totalCitasAgendadas: number;
    totalCanceladas: number;
    canceladasPct: number;
    totalSesionesRealizadas: number;
    tasaConversion: number;
    ingresoEsperado: number;
    ingresoReal: number;
    porPaquete: PaqueteConversion[];
    citas: SesionCita[];
    calendarData: CalendarDayData[];
    ventasByDay: Record<string, Record<string, { sesiones: number; ingreso: number }>>;
  };
}

const fmtCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
const fmtPct = (val: number) => `${val.toFixed(1)}%`

function citaToDateKey(cita: SesionCita): string {
  const parts = cita.fecha.split('/')
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
  return ''
}

export default function SesionesContent({ metrics }: SesionesContentProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Compute filtered data based on selectedDay
  const filtered = useMemo(() => {
    if (!selectedDay) {
      return {
        totalCitasAgendadas: metrics.totalCitasAgendadas,
        totalCanceladas: metrics.totalCanceladas,
        canceladasPct: metrics.canceladasPct,
        totalSesionesRealizadas: metrics.totalSesionesRealizadas,
        tasaConversion: metrics.tasaConversion,
        ingresoEsperado: metrics.ingresoEsperado,
        ingresoReal: metrics.ingresoReal,
        porPaquete: metrics.porPaquete,
        citas: metrics.citas,
      }
    }

    // Filter citas by selected day
    const dayCitas = metrics.citas.filter(c => citaToDateKey(c) === selectedDay)
    const dayActivas = dayCitas.filter(c => !c.cancelada)
    const dayCanceladas = dayCitas.filter(c => c.cancelada)

    // Ventas for that day
    const dayVentas = metrics.ventasByDay[selectedDay] || {}
    let daySesiones = 0
    let dayIngresoReal = 0
    for (const paq of Object.values(dayVentas)) {
      daySesiones += paq.sesiones
      dayIngresoReal += paq.ingreso
    }

    const totalCitasAgendadas = dayActivas.length
    const totalCanceladas = dayCanceladas.length
    const totalAll = dayCitas.length
    const canceladasPct = totalAll > 0 ? (totalCanceladas / totalAll) * 100 : 0
    const tasaConversion = totalCitasAgendadas > 0 ? (daySesiones / totalCitasAgendadas) * 100 : 0
    const ingresoEsperado = dayActivas.reduce((s, c) => s + c.precioEsperado, 0)

    // Build per-package table for this day
    const citasPorPaq: Record<string, { citas: number; ingresoEsperado: number }> = {}
    for (const cita of dayActivas) {
      const key = cita.paqueteNombre
      if (!citasPorPaq[key]) citasPorPaq[key] = { citas: 0, ingresoEsperado: 0 }
      citasPorPaq[key].citas++
      citasPorPaq[key].ingresoEsperado += cita.precioEsperado
    }

    const allPaqs = new Set([...Object.keys(citasPorPaq), ...Object.keys(dayVentas)])
    const porPaquete: PaqueteConversion[] = []
    for (const paq of allPaqs) {
      const c = citasPorPaq[paq] || { citas: 0, ingresoEsperado: 0 }
      const v = dayVentas[paq] || { sesiones: 0, ingreso: 0 }
      porPaquete.push({
        paquete: paq,
        citasAgendadas: c.citas,
        sesionesReales: v.sesiones,
        conversionPct: c.citas > 0 ? (v.sesiones / c.citas) * 100 : 0,
        ingresoEsperado: c.ingresoEsperado,
        ingresoReal: v.ingreso,
        diferencia: v.ingreso - c.ingresoEsperado,
      })
    }
    porPaquete.sort((a, b) => b.citasAgendadas - a.citasAgendadas)

    return {
      totalCitasAgendadas,
      totalCanceladas,
      canceladasPct,
      totalSesionesRealizadas: daySesiones,
      tasaConversion,
      ingresoEsperado,
      ingresoReal: dayIngresoReal,
      porPaquete,
      citas: dayCitas,
    }
  }, [selectedDay, metrics])

  // Format the selected day for display
  const selectedDayLabel = selectedDay
    ? (() => { const p = selectedDay.split('-'); return `${p[2]}/${p[1]}/${p[0]}` })()
    : null

  return (
    <div>
      {/* Day filter indicator */}
      {selectedDay && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm text-primary font-medium">
            Filtrando por: {selectedDayLabel}
          </span>
          <button
            onClick={() => setSelectedDay(null)}
            className="text-xs px-3 py-1 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            Quitar filtro
          </button>
        </div>
      )}

      {/* SECCIÓN 1 — KPIs */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Conversión de Citas</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Citas Agendadas" value={filtered.totalCitasAgendadas.toString()} subtitle="Sin canceladas" color="blue" />
        <KpiCard title="Cancelados" value={filtered.totalCanceladas.toString()} subtitle={`${fmtPct(filtered.canceladasPct)} del total`} color="red" />
        <KpiCard title="Sesiones Realizadas" value={filtered.totalSesionesRealizadas.toString()} subtitle="VENTAS + OTROS" color="green" />
        <KpiCard
          title="Tasa de Conversión"
          value={fmtPct(filtered.tasaConversion)}
          subtitle={`${filtered.totalSesionesRealizadas} de ${filtered.totalCitasAgendadas}`}
          color={filtered.tasaConversion >= 70 ? 'green' : filtered.tasaConversion >= 50 ? 'yellow' : 'red'}
        />
        <div className="glass-card p-6 relative overflow-hidden">
          <p className="text-sm font-medium text-muted-foreground mb-1">Ingreso Esperado vs Real</p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xl font-bold">{fmtCurrency(filtered.ingresoReal)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Esperado: {fmtCurrency(filtered.ingresoEsperado)}</span>
          </div>
          <div className="mt-2">
            <span className={`text-sm font-medium ${filtered.ingresoReal - filtered.ingresoEsperado >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {fmtCurrency(filtered.ingresoReal - filtered.ingresoEsperado)}
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2 — Calendario Visual */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Calendario de Citas</h3>
      <div className="glass-card p-6 mb-8">
        <CalendarView data={metrics.calendarData} selectedDay={selectedDay} onDayClick={setSelectedDay} />
      </div>

      {/* SECCIÓN 3 — Tabla Comparativa por Paquete */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Comparativa por Paquete</h3>
      <div className="glass-card p-6 mb-8">
        <PaqueteConversionTable rows={filtered.porPaquete} />
      </div>

      {/* SECCIÓN 4 — Tabla Detallada */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Detalle de Citas</h3>
      <div className="glass-card p-6 mb-8">
        <CitasTable citas={filtered.citas} />
      </div>
    </div>
  )
}

// --- Sub-components ---

function KpiCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: 'blue' | 'green' | 'yellow' | 'red' }) {
  const colorMap = { blue: 'text-blue-400', green: 'text-primary', yellow: 'text-yellow-400', red: 'text-destructive' }
  return (
    <div className="glass-card p-6 relative overflow-hidden">
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <h2 className={`text-2xl font-bold tracking-tight mb-1 ${colorMap[color]}`}>{value}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function PaqueteConversionTable({ rows }: { rows: PaqueteConversion[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
  const totCitas = rows.reduce((s, r) => s + r.citasAgendadas, 0)
  const totSesiones = rows.reduce((s, r) => s + r.sesionesReales, 0)
  const totConv = totCitas > 0 ? (totSesiones / totCitas) * 100 : 0
  const totEsperado = rows.reduce((s, r) => s + r.ingresoEsperado, 0)
  const totReal = rows.reduce((s, r) => s + r.ingresoReal, 0)
  const totDiff = totReal - totEsperado

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4 font-medium">Paquete</th>
            <th className="pb-3 pr-4 font-medium text-right">Citas</th>
            <th className="pb-3 pr-4 font-medium text-right">Sesiones</th>
            <th className="pb-3 pr-4 font-medium text-right">Conversión</th>
            <th className="pb-3 pr-4 font-medium text-right">Esperado</th>
            <th className="pb-3 pr-4 font-medium text-right">Real</th>
            <th className="pb-3 pr-4 font-medium text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.paquete} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
              <td className="py-3 pr-4 font-medium">{row.paquete}</td>
              <td className="py-3 pr-4 text-right">{row.citasAgendadas}</td>
              <td className="py-3 pr-4 text-right">{row.sesionesReales}</td>
              <td className={`py-3 pr-4 text-right font-medium ${row.conversionPct >= 70 ? 'text-primary' : row.conversionPct >= 50 ? 'text-yellow-400' : 'text-destructive'}`}>
                {fmtPct(row.conversionPct)}
              </td>
              <td className="py-3 pr-4 text-right text-muted-foreground">{fmtCurrency(row.ingresoEsperado)}</td>
              <td className="py-3 pr-4 text-right">{fmtCurrency(row.ingresoReal)}</td>
              <td className={`py-3 pr-4 text-right font-medium ${row.diferencia >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {fmtCurrency(row.diferencia)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 font-semibold">
            <td className="py-3 pr-4">TOTAL</td>
            <td className="py-3 pr-4 text-right">{totCitas}</td>
            <td className="py-3 pr-4 text-right">{totSesiones}</td>
            <td className={`py-3 pr-4 text-right ${totConv >= 70 ? 'text-primary' : totConv >= 50 ? 'text-yellow-400' : 'text-destructive'}`}>{fmtPct(totConv)}</td>
            <td className="py-3 pr-4 text-right text-muted-foreground">{fmtCurrency(totEsperado)}</td>
            <td className="py-3 pr-4 text-right">{fmtCurrency(totReal)}</td>
            <td className={`py-3 pr-4 text-right ${totDiff >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtCurrency(totDiff)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CitasTable({ citas }: { citas: SesionCita[] }) {
  if (citas.length === 0) return <p className="text-sm text-muted-foreground">Sin citas en este período</p>
  return (
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4 font-medium">Fecha</th>
            <th className="pb-3 pr-4 font-medium">Inicio</th>
            <th className="pb-3 pr-4 font-medium">Final</th>
            <th className="pb-3 pr-4 font-medium">Título</th>
            <th className="pb-3 pr-4 font-medium">Paquete</th>
            <th className="pb-3 pr-4 font-medium text-right">Precio Esperado</th>
            <th className="pb-3 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {citas.map((cita, idx) => (
            <tr key={`${cita.fecha}-${cita.horaInicio}-${idx}`} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
              <td className="py-3 pr-4">{cita.fecha}</td>
              <td className="py-3 pr-4">{cita.horaInicio}</td>
              <td className="py-3 pr-4">{cita.horaFinal}</td>
              <td className="py-3 pr-4 font-medium max-w-[200px] truncate">{cita.titulo}</td>
              <td className="py-3 pr-4">{cita.paqueteNombre}</td>
              <td className="py-3 pr-4 text-right">{fmtCurrency(cita.precioEsperado)}</td>
              <td className="py-3 text-center">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  cita.cancelada
                    ? 'bg-yellow-500/15 text-yellow-400'
                    : cita.realizada
                      ? 'bg-primary/15 text-primary'
                      : 'bg-destructive/15 text-destructive'
                }`}>
                  {cita.cancelada ? 'Cancelado' : cita.realizada ? 'Realizada' : 'Pendiente'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
