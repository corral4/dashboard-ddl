import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PeriodSelector from '@/components/PeriodSelector'
import { Suspense } from 'react'
import AnalisisChat from './AnalisisChat'

export default async function AnalisisPage(props: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const sucursal = user.user_metadata?.sucursal || ''
  const period = searchParams.period || 'YTD'

  const periodLabels: Record<string, string> = {
    YTD: 'Año a la fecha',
    CURRENT_MONTH: 'Este mes',
    ALL_YEAR: 'Todo el año',
  }
  const periodLabel = periodLabels[period] || period

  return (
    <DashboardLayout userEmail={user.email ?? ''} activePage="analisis">
      <div className="flex justify-between items-center mb-2 mt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Análisis IA</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Consulta cualquier dato de tu negocio en lenguaje natural
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-md bg-secondary/50 text-muted-foreground">
            {periodLabel}
          </span>
          <Suspense fallback={<div className="w-40 h-9 bg-secondary/50 animate-pulse rounded-md"></div>}>
            <PeriodSelector />
          </Suspense>
        </div>
      </div>

      <div className="glass-card p-6 flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <AnalisisChat sucursal={sucursal} period={period} />
      </div>
    </DashboardLayout>
  )
}
