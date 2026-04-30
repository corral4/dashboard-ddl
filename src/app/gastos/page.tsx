import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PeriodSelector from '@/components/PeriodSelector'
import { Suspense } from 'react'
import { getGastosMetrics, type SubRubroRow, type EmpleadoRow, type PaqueteRow } from '@/services/gastosMetrics'
import { isEmailAuthorized } from '@/utils/auth'

export default async function GastosPage(props: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (!isEmailAuthorized(user.email)) redirect('/no-autorizado')

  const period = searchParams.period || 'YTD'

  let metrics: any = null
  try {
    metrics = await getGastosMetrics('all', period)
  } catch (e) {
    console.error('Error fetching gastos metrics:', e)
  }

  if (!metrics) {
    return (
      <DashboardLayout userEmail={user.email ?? ''} activePage="gastos">
        <p className="text-muted-foreground">No se pudieron cargar los datos de Gastos.</p>
      </DashboardLayout>
    )
  }

  const fmt = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  const fmtPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`

  return (
    <DashboardLayout userEmail={user.email ?? ''} activePage="gastos">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-2xl font-bold tracking-tight">Gastos y Rentabilidad</h2>
        <Suspense fallback={<div className="w-40 h-9 bg-secondary/50 animate-pulse rounded-md"></div>}>
          <PeriodSelector />
        </Suspense>
      </div>

      {/* SECCIÓN 1 — Margen Bruto + Sesiones vs PPTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Margen Bruto */}
        <div className="glass-card p-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Margen Bruto</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Real</span>
              <span className="text-xl font-bold">{fmt(metrics.margenBrutoReal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">PPTO</span>
              <span className="text-lg text-muted-foreground">{fmt(metrics.margenBrutoPpto)}</span>
            </div>
            <div className="h-px bg-border"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Desviación</span>
              <span className={`text-lg font-semibold ${metrics.margenBrutoReal - metrics.margenBrutoPpto >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {fmt(metrics.margenBrutoReal - metrics.margenBrutoPpto)}
                <span className="text-sm ml-2">
                  {metrics.margenBrutoPpto !== 0 
                    ? fmtPct(((metrics.margenBrutoReal - metrics.margenBrutoPpto) / metrics.margenBrutoPpto) * 100)
                    : '—'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Sesiones vs PPTO Clientes */}
        <div className="glass-card p-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Sesiones vs PPTO Clientes</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sesiones Reales</span>
              <span className="text-xl font-bold">{metrics.sesionesReales}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">PPTO Clientes</span>
              <span className="text-lg text-muted-foreground">{metrics.pptoClientes}</span>
            </div>
            <div className="h-px bg-border"></div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Desviación</span>
              {(() => {
                const diff = metrics.sesionesReales - metrics.pptoClientes;
                const pct = metrics.pptoClientes !== 0 ? (diff / metrics.pptoClientes) * 100 : 0;
                return (
                  <span className={`text-lg font-semibold ${diff >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {diff >= 0 ? '+' : ''}{diff}
                    <span className="text-sm ml-2">{fmtPct(pct)}</span>
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2 — Ventas por Paquete */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Ventas por Paquete vs PPTO</h3>
      <div className="glass-card p-6 mb-8">
        <PaqueteTable rows={metrics.ventasPorPaquete} fmt={fmt} fmtPct={fmtPct} />
      </div>

      {/* SECCIÓN 3 — KPIs por Categoría */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Egresos vs Presupuesto</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <GastoKpiCard
          title="Gastos de Operación"
          real={metrics.gastosOperacionReal}
          ppto={metrics.gastosOperacionPpto}
          fmt={fmt}
          fmtPct={fmtPct}
        />
        <GastoKpiCard
          title="Nómina"
          real={metrics.nominaReal}
          ppto={metrics.nominaPpto}
          fmt={fmt}
          fmtPct={fmtPct}
        />
        <GastoKpiCard
          title="Costo de Venta"
          real={metrics.costoVentaReal}
          ppto={metrics.costoVentaPpto}
          fmt={fmt}
          fmtPct={fmtPct}
        />
      </div>

      {/* SECCIÓN 4 — Costo de Venta por Paquete */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Desglose por Categoría</h3>
      <div className="space-y-6 mb-8">
        <div className="glass-card p-6">
          <h4 className="font-semibold mb-4">Costo de Venta por Paquete</h4>
          <SubRubroTable rows={metrics.costoVentaDetalle} fmt={fmt} fmtPct={fmtPct} />
        </div>

        {/* SECCIÓN 5 — Gastos de Operación por Rubro */}
        <div className="glass-card p-6">
          <h4 className="font-semibold mb-4">Gastos de Operación por Rubro</h4>
          <SubRubroTable rows={metrics.gastosOperacionDetalle} fmt={fmt} fmtPct={fmtPct} />
        </div>

        {/* SECCIÓN 6 — Nómina por Empleado */}
        <div className="glass-card p-6">
          <h4 className="font-semibold mb-4">Nómina por Empleado</h4>
          <EmpleadoTable rows={metrics.nominaDetalle} fmt={fmt} fmtPct={fmtPct} />
        </div>
      </div>
    </DashboardLayout>
  )
}

// --- Componentes ---

function GastoKpiCard({ title, real, ppto, fmt, fmtPct }: { title: string; real: number; ppto: number; fmt: (v: number) => string; fmtPct: (v: number) => string }) {
  const desviacion = real - ppto;
  const desviacionPct = ppto !== 0 ? (desviacion / ppto) * 100 : 0;
  const overBudget = real > ppto && ppto > 0;

  return (
    <div className={`glass-card p-6 relative overflow-hidden border-l-4 ${overBudget ? 'border-l-destructive' : 'border-l-primary'}`}>
      <p className="text-sm font-medium text-muted-foreground mb-3">{title}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">{fmt(real)}</h2>
        <span className="text-sm text-muted-foreground">vs {fmt(ppto)}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${desviacion > 0 ? 'text-destructive' : 'text-primary'}`}>
          {fmt(desviacion)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          overBudget 
            ? 'bg-destructive/15 text-destructive' 
            : 'bg-primary/15 text-primary'
        }`}>
          {fmtPct(desviacionPct)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.min((real / (ppto || 1)) * 100, 100)}%` }}
        ></div>
      </div>
    </div>
  )
}

function SubRubroTable({ rows, fmt, fmtPct }: { rows: SubRubroRow[]; fmt: (v: number) => string; fmtPct: (v: number) => string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin datos disponibles</p>;
  const totalReal = rows.reduce((s, r) => s + r.real, 0);
  const totalPpto = rows.reduce((s, r) => s + r.ppto, 0);
  const totalDesv = totalReal - totalPpto;
  const totalDesvPct = totalPpto !== 0 ? (totalDesv / totalPpto) * 100 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4 font-medium">SubRubro</th>
            <th className="pb-3 pr-4 font-medium text-right">Real</th>
            <th className="pb-3 pr-4 font-medium text-right">PPTO</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación $</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación %</th>
            <th className="pb-3 font-medium w-32">vs PPTO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overBudget = row.real > row.ppto && row.ppto > 0;
            const pctOfPpto = row.ppto > 0 ? (row.real / row.ppto) * 100 : 0;
            return (
              <tr key={row.subRubro} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="py-3 pr-4 font-medium">{row.subRubro}</td>
                <td className="py-3 pr-4 text-right">{fmt(row.real)}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(row.ppto)}</td>
                <td className={`py-3 pr-4 text-right font-medium ${row.desviacion > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {fmt(row.desviacion)}
                </td>
                <td className={`py-3 pr-4 text-right ${row.desviacion > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {fmtPct(row.desviacionPct)}
                </td>
                <td className="py-3">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(pctOfPpto, 100)}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 font-semibold">
            <td className="py-3 pr-4">TOTAL</td>
            <td className="py-3 pr-4 text-right">{fmt(totalReal)}</td>
            <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(totalPpto)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv > 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(totalDesv)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv > 0 ? 'text-destructive' : 'text-primary'}`}>{fmtPct(totalDesvPct)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmpleadoTable({ rows, fmt, fmtPct }: { rows: EmpleadoRow[]; fmt: (v: number) => string; fmtPct: (v: number) => string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin datos disponibles</p>;
  const totalReal = rows.reduce((s, r) => s + r.real, 0);
  const totalPpto = rows.reduce((s, r) => s + r.ppto, 0);
  const totalDesv = totalReal - totalPpto;
  const totalDesvPct = totalPpto !== 0 ? (totalDesv / totalPpto) * 100 : 0;
  const totalOver = totalReal > totalPpto && totalPpto > 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4 font-medium">Empleado</th>
            <th className="pb-3 pr-4 font-medium text-right">Real</th>
            <th className="pb-3 pr-4 font-medium text-right">PPTO</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación $</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación %</th>
            <th className="pb-3 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const overBudget = row.real > row.ppto && row.ppto > 0;
            return (
              <tr key={row.empleado} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="py-3 pr-4 font-medium">{row.empleado}</td>
                <td className="py-3 pr-4 text-right">{fmt(row.real)}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(row.ppto)}</td>
                <td className={`py-3 pr-4 text-right font-medium ${row.desviacion > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {fmt(row.desviacion)}
                </td>
                <td className={`py-3 pr-4 text-right ${row.desviacion > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {fmtPct(row.desviacionPct)}
                </td>
                <td className="py-3 text-center">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    overBudget 
                      ? 'bg-destructive/15 text-destructive' 
                      : 'bg-primary/15 text-primary'
                  }`}>
                    {overBudget ? 'Sobre PPTO' : 'En PPTO'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 font-semibold">
            <td className="py-3 pr-4">TOTAL</td>
            <td className="py-3 pr-4 text-right">{fmt(totalReal)}</td>
            <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(totalPpto)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv > 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(totalDesv)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv > 0 ? 'text-destructive' : 'text-primary'}`}>{fmtPct(totalDesvPct)}</td>
            <td className="py-3 text-center">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                totalOver ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
              }`}>
                {totalOver ? 'Sobre PPTO' : 'En PPTO'}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PaqueteTable({ rows, fmt, fmtPct }: { rows: PaqueteRow[]; fmt: (v: number) => string; fmtPct: (v: number) => string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin datos disponibles</p>;
  const totalSesiones = rows.reduce((s, r) => s + r.sesiones, 0);
  const totalPptoSes = rows.reduce((s, r) => s + r.pptoSesiones, 0);
  const totalDesvSes = totalSesiones - totalPptoSes;
  const totalIngreso = rows.reduce((s, r) => s + r.ingresoReal, 0);
  const totalPpto = rows.reduce((s, r) => s + r.pptoIngreso, 0);
  const totalDesv = totalIngreso - totalPpto;
  const totalDesvPct = totalPpto !== 0 ? (totalDesv / totalPpto) * 100 : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-3 pr-4 font-medium">Paquete</th>
            <th className="pb-3 pr-4 font-medium text-right">Sesiones</th>
            <th className="pb-3 pr-4 font-medium text-right">PPTO Ses.</th>
            <th className="pb-3 pr-4 font-medium text-right">Desv. Ses.</th>
            <th className="pb-3 pr-4 font-medium text-right">Ingreso Real</th>
            <th className="pb-3 pr-4 font-medium text-right">PPTO Ingreso</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación $</th>
            <th className="pb-3 pr-4 font-medium text-right">Desviación %</th>
            <th className="pb-3 font-medium w-32">vs PPTO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pctOfPpto = row.pptoIngreso > 0 ? (row.ingresoReal / row.pptoIngreso) * 100 : 0;
            const overBudget = row.ingresoReal < row.pptoIngreso && row.pptoIngreso > 0;
            return (
              <tr key={row.paquete} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="py-3 pr-4 font-medium">{row.paquete}</td>
                <td className="py-3 pr-4 text-right">{row.sesiones}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{row.pptoSesiones}</td>
                <td className={`py-3 pr-4 text-right font-medium ${row.desvSesiones >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {row.desvSesiones >= 0 ? '+' : ''}{row.desvSesiones}
                </td>
                <td className="py-3 pr-4 text-right">{fmt(row.ingresoReal)}</td>
                <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(row.pptoIngreso)}</td>
                <td className={`py-3 pr-4 text-right font-medium ${row.desviacion >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {fmt(row.desviacion)}
                </td>
                <td className={`py-3 pr-4 text-right ${row.desviacion >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {fmtPct(row.desviacionPct)}
                </td>
                <td className="py-3">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${overBudget ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(pctOfPpto, 100)}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/40 font-semibold">
            <td className="py-3 pr-4">TOTAL</td>
            <td className="py-3 pr-4 text-right">{totalSesiones}</td>
            <td className="py-3 pr-4 text-right text-muted-foreground">{totalPptoSes}</td>
            <td className={`py-3 pr-4 text-right ${totalDesvSes >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {totalDesvSes >= 0 ? '+' : ''}{totalDesvSes}
            </td>
            <td className="py-3 pr-4 text-right">{fmt(totalIngreso)}</td>
            <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(totalPpto)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(totalDesv)}</td>
            <td className={`py-3 pr-4 text-right ${totalDesv >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtPct(totalDesvPct)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
