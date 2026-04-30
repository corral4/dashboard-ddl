import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getMetricsForSucursal } from '@/services/metrics'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Validar sesión
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener la sucursal del metadata del usuario
    const sucursal = user.user_metadata?.sucursal
    if (!sucursal) {
      return NextResponse.json({ error: 'El usuario no tiene una sucursal asignada' }, { status: 400 })
    }

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || 'YTD'

    // Obtener métricas desde Google Sheets
    const metrics = await getMetricsForSucursal(sucursal, period)
    
    return NextResponse.json(metrics)

  } catch (error: any) {
    console.error('Error en /api/metrics:', error)
    return NextResponse.json(
      { error: 'Error obteniendo métricas', details: error.message }, 
      { status: 500 }
    )
  }
}
