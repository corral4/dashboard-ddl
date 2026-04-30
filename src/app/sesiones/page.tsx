import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PeriodSelector from '@/components/PeriodSelector'
import CalendarFilter from './CalendarFilter'
import { Suspense } from 'react'
import { getSesionesMetrics } from '@/services/sesionesMetrics'
import SesionesContent from './SesionesContent'
import { isEmailAuthorized } from '@/utils/auth'

export default async function SesionesPage(props: { searchParams: Promise<{ period?: string; cal?: string }> }) {
  const supabase = await createClient()
  const searchParams = await props.searchParams

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  if (!isEmailAuthorized(user.email)) redirect('/no-autorizado')

  const period = searchParams.period || 'YTD'
  const calFilter = (searchParams.cal || 'all') as 'all' | 'cal1' | 'cal2'

  let metrics: any = null
  try {
    metrics = await getSesionesMetrics('all', period, calFilter)
  } catch (e) {
    console.error('Error fetching sesiones metrics:', e)
  }

  if (!metrics) {
    return (
      <DashboardLayout userEmail={user.email ?? ''} activePage="sesiones">
        <p className="text-muted-foreground">No se pudieron cargar los datos de Sesiones.</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userEmail={user.email ?? ''} activePage="sesiones">
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-2xl font-bold tracking-tight">Sesiones</h2>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="w-28 h-9 bg-secondary/50 animate-pulse rounded-md"></div>}>
            <CalendarFilter />
          </Suspense>
          <Suspense fallback={<div className="w-40 h-9 bg-secondary/50 animate-pulse rounded-md"></div>}>
            <PeriodSelector />
          </Suspense>
        </div>
      </div>

      <SesionesContent metrics={metrics} />
    </DashboardLayout>
  )
}
