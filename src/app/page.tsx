import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { MainChart } from '@/components/DashboardCharts'
import PeriodSelector from '@/components/PeriodSelector'
import { Suspense } from 'react'
import { DollarSign, Users, Activity, CreditCard, Wallet } from 'lucide-react'
import { getMetricsForSucursal } from '@/services/metrics'
import { isEmailAuthorized } from '@/utils/auth'

export default async function Home(props: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  if (!isEmailAuthorized(user.email)) {
    redirect('/no-autorizado')
  }

  let metrics: any = {
    ingresoTotal: 0,
    totalSesiones: 0,
    anticipoAcumulado: 0,
    saldoPendiente: 0,
    ventasNetas: 0,
    egresoResultados: 0,
    margenNeto: 0,
    margenPorcentaje: 0,
    pptoVentas: 0,
    desviacionVentas: 0,
    desviacionVentasPct: 0,
    monthlyData: []
  }

  const period = searchParams.period || 'YTD'

  try {
    metrics = await getMetricsForSucursal('all', period)
  } catch (e) {
    console.error('Error fetching metrics desde Google Sheets:', e)
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  const formatPercent = (val: number) => `${val.toFixed(2)}%`

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const chartData = (metrics.monthlyData || []).map((d: any) => ({
    monthName: monthNames[d.month],
    ventasNetas: d.ventasNetas,
    pptoVentas: d.pptoVentas
  }));

  return (
    <DashboardLayout userEmail={user.email ?? 'Usuario Desconocido'} activePage="resumen">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-2xl font-bold tracking-tight">Resumen Financiero</h2>
        <Suspense fallback={<div className="w-40 h-9 bg-secondary/50 animate-pulse rounded-md"></div>}>
          <PeriodSelector />
        </Suspense>
      </div>

      {/* KPIs Fila 1: Ingresos */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Ingresos</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Ventas Netas"
          amount={formatCurrency(metrics.ingresoTotal)}
          icon={<DollarSign className="text-primary" size={24} />}
        />
        <KpiCard
          title="Total Sesiones"
          amount={metrics.totalSesiones.toString()}
          icon={<Users className="text-blue-500" size={24} />}
        />
        <KpiCard
          title="PPTO Ventas"
          amount={formatCurrency(metrics.pptoVentas)}
          icon={<Wallet className="text-purple-500" size={24} />}
        />
        <KpiCard
          title="Desviación Ventas ($)"
          amount={formatCurrency(metrics.desviacionVentas)}
          valueColor={metrics.desviacionVentas >= 0 ? 'primary' : 'destructive'}
          icon={<Activity className={metrics.desviacionVentas >= 0 ? "text-primary" : "text-destructive"} size={24} />}
        />
        <KpiCard
          title="Desviación Ventas (%)"
          amount={formatPercent(metrics.desviacionVentasPct)}
          valueColor={metrics.desviacionVentasPct >= 0 ? 'primary' : 'destructive'}
          icon={<Activity className={metrics.desviacionVentasPct >= 0 ? "text-primary" : "text-destructive"} size={24} />}
        />
      </div>

      {/* KPIs Fila 2: Resultados */}
      <h3 className="font-semibold text-lg mb-4 text-muted-foreground">Resultados</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Egreso Resultados"
          amount={formatCurrency(metrics.egresoResultados)}
          icon={<CreditCard className="text-orange-500" size={24} />}
        />
        <KpiCard
          title="Margen Neto"
          amount={formatCurrency(metrics.margenNeto)}
          icon={<DollarSign className="text-primary" size={24} />}
        />
        <KpiCard
          title="Margen (%)"
          amount={formatPercent(metrics.margenPorcentaje)}
          valueColor={metrics.margenPorcentaje >= 0 ? 'primary' : 'destructive'}
          icon={<Activity className={metrics.margenPorcentaje >= 0 ? "text-primary" : "text-destructive"} size={24} />}
        />
        <KpiCard
          title="Margen Neto PPTO"
          amount={formatCurrency(metrics.pptoVentas - metrics.pptoEgresosResultados)}
          icon={<Wallet className="text-blue-500" size={24} />}
        />
        {(() => {
          const margenNetoPpto = metrics.pptoVentas - metrics.pptoEgresosResultados;
          const diffMargen = metrics.margenNeto - margenNetoPpto;
          return (
            <KpiCard
              title="Diferencia Margen $"
              amount={formatCurrency(diffMargen)}
              valueColor={diffMargen >= 0 ? 'primary' : 'destructive'}
              icon={<Activity className={diffMargen >= 0 ? 'text-primary' : 'text-destructive'} size={24} />}
            />
          );
        })()}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Chart */}
        <div className="glass-card p-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-semibold text-lg">Evolución de Ventas</h3>
              <p className="text-sm text-muted-foreground">Ventas Reales vs PPTO (Mensual)</p>
            </div>
            <select className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm outline-none">
              <option>Este Año</option>
            </select>
          </div>
          <MainChart data={chartData} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function KpiCard({ title, amount, icon, valueColor = 'default', subtitle }: { title: string, amount: string, icon: React.ReactNode, valueColor?: 'default' | 'primary' | 'destructive', subtitle?: string }) {
  const colorClass = valueColor === 'primary' ? 'text-primary' : valueColor === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="glass-card p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <h2 className={`text-2xl font-bold tracking-tight mb-2 ${colorClass}`}>{amount}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  )
}
