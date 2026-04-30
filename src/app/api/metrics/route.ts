import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getMetricsForSucursal } from '@/services/metrics'
import { isEmailAuthorized } from '@/utils/auth'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Validar sesión y permisos
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!isEmailAuthorized(user.email)) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 })
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || 'YTD'

    // Obtener métricas desde Google Sheets
    const metrics = await getMetricsForSucursal('all', period)
    
    return NextResponse.json(metrics)

  } catch (error: any) {
    console.error('Error en /api/metrics:', error)
    return NextResponse.json(
      { error: 'Error obteniendo métricas', details: error.message }, 
      { status: 500 }
    )
  }
}
