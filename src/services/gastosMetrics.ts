import { google } from 'googleapis'

// --- Interfaces ---
export interface SubRubroRow {
  subRubro: string;
  real: number;
  ppto: number;
  desviacion: number;
  desviacionPct: number;
}

export interface EmpleadoRow {
  empleado: string;
  real: number;
  ppto: number;
  desviacion: number;
  desviacionPct: number;
}

export interface PaqueteRow {
  paquete: string;
  sesiones: number;
  pptoSesiones: number;
  desvSesiones: number;
  ingresoReal: number;
  pptoIngreso: number;
  desviacion: number;
  desviacionPct: number;
}

export interface GastosMetricsResult {
  // Sección 1 — KPIs por categoría
  gastosOperacionReal: number;
  gastosOperacionPpto: number;
  nominaReal: number;
  nominaPpto: number;
  costoVentaReal: number;
  costoVentaPpto: number;

  // Sección 2 — Tablas desglosadas
  gastosOperacionDetalle: SubRubroRow[];
  nominaDetalle: EmpleadoRow[];
  costoVentaDetalle: SubRubroRow[];

  // Sección 3 — Ventas por Paquete
  ventasPorPaquete: PaqueteRow[];

  // Sección 4 — Margen Bruto
  margenBrutoReal: number;
  margenBrutoPpto: number;

  // Sección 5 — Sesiones vs PPTO Clientes
  sesionesReales: number;
  pptoClientes: number;
}

// --- Parser numérico universal (mismo que metrics.ts) ---
function parseNumber(value: any): number {
  if (value === undefined || value === null) return 0;
  const str = value.toString().trim();
  if (str === "-" || str === "") return 0;
  
  let cleaned = str.replace(/[\$\s]/g, "");
  
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    cleaned = cleaned.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(cleaned) && !/\.\d{1,2}$/.test(cleaned.replace(/\.\d{3}$/, ''))) {
    cleaned = cleaned.replace(/\./g, "");
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const s = dateStr.toString().trim();
  if (s === '-' || s === '') return null;
  
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }
  
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function isDateInPeriod(dateObj: Date | null, period: string, currentYear: number, currentMonth: number): boolean {
  if (!dateObj) return false;
  if (dateObj.getFullYear() !== currentYear) return false;
  const m = dateObj.getMonth();
  if (period === 'ALL_YEAR') return true;
  if (period === 'YTD') return m <= currentMonth;
  if (period === 'CURRENT_MONTH') return m === currentMonth;
  if (period.startsWith('MONTH_')) return m === parseInt(period.split('_')[1], 10);
  return true;
}

// --- Función principal ---
export async function getGastosMetrics(sucursal: string, period: string = 'YTD'): Promise<GastosMetricsResult> {
  console.log('[gastosMetrics] === getGastosMetrics START ===');
  console.log('[gastosMetrics] GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL?.substring(0, 20));
  console.log('[gastosMetrics] SPREADSHEET_ID:', process.env.GOOGLE_SPREADSHEET_ID?.substring(0, 10));
  console.log('[gastosMetrics] SPREADSHEET_ID_ACTUAL:', process.env.GOOGLE_SPREADSHEET_ID_ACTUAL?.substring(0, 10));
  console.log('[gastosMetrics] SPREADSHEET_ID_PPTO:', process.env.GOOGLE_SPREADSHEET_ID_PPTO?.substring(0, 10));
  console.log('[gastosMetrics] PRIVATE_KEY exists:', !!process.env.GOOGLE_PRIVATE_KEY);

  try {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetIdVentas = process.env.GOOGLE_SPREADSHEET_ID!;
  const spreadsheetIdActual = process.env.GOOGLE_SPREADSHEET_ID_ACTUAL!;
  const spreadsheetIdPpto = process.env.GOOGLE_SPREADSHEET_ID_PPTO!;

  async function getRows(sheetName: string, id: string) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: `${sheetName}!A:Z`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error leyendo la hoja ${sheetName}:`, error);
      return [];
    }
  }

  // Acumuladores
  let gastosOperacionReal = 0, gastosOperacionPpto = 0;
  let nominaReal = 0, nominaPpto = 0;
  let costoVentaReal = 0, costoVentaPpto = 0;
  let pptoClientes = 0;

  const gastosOpByRubro: Record<string, { real: number; ppto: number }> = {};
  const nominaByEmpleado: Record<string, { real: number; ppto: number }> = {};
  const costoVentaBySubRubro: Record<string, { real: number; ppto: number }> = {};
  const costoVentaByPaquete: Record<string, { real: number; ppto: number }> = {};
  const ventasByPaquete: Record<string, { sesiones: number; ingreso: number }> = {};
  const pptoVentasBySubRubro: Record<string, number> = {};
  const pptoSesionesByPaquete: Record<string, number> = {};

  let totalIngresosReal = 0;
  let totalCostoVentaReal = 0;
  let pptoVentasNetasTotal = 0;
  let pptoCostoVentaTotal = 0;
  let sesionesReales = 0;

  // --- Procesar VENTAS y OTROS ---
  const procesarVentasOtros = async (sheetName: string) => {
    const rows = await getRows(sheetName, spreadsheetIdVentas);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];

    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'neto');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const paqueteIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'paquete');

    if (sucursalIdx === -1) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;
        const fechaRaw = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
        const dateObj = parseDate(fechaRaw);
        const paquete = paqueteIdx !== -1 && row[paqueteIdx] ? row[paqueteIdx].toString().trim() : 'Sin Paquete';

        if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
          sesionesReales++;
          totalIngresosReal += neto;

          if (!ventasByPaquete[paquete]) ventasByPaquete[paquete] = { sesiones: 0, ingreso: 0 };
          ventasByPaquete[paquete].sesiones++;
          ventasByPaquete[paquete].ingreso += neto;

          // Acumular costo de venta por paquete (de VENTAS/OTROS)
          if (!costoVentaByPaquete[paquete]) costoVentaByPaquete[paquete] = { real: 0, ppto: 0 };
          // Se llena con datos de ACTUAL más abajo; aquí solo creamos la key
        }
      }
    }
  };

  // --- Procesar GASTOS (hoja GASTOS → suma a Gastos de Operación) ---
  const procesarGastos = async () => {
    const rows = await getRows('GASTOS', spreadsheetIdVentas);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];

    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'neto');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const subRubroIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'subrubro');

    if (sucursalIdx === -1) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;
        const fechaRaw = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
        const dateObj = parseDate(fechaRaw);
        const subRubro = subRubroIdx !== -1 && row[subRubroIdx] ? row[subRubroIdx].toString().trim() : 'Sin SubRubro';

        if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
          gastosOperacionReal += neto;
          if (!gastosOpByRubro[subRubro]) gastosOpByRubro[subRubro] = { real: 0, ppto: 0 };
          gastosOpByRubro[subRubro].real += neto;
        }
      }
    }
  };

  // --- Procesar ACTUAL ---
  const procesarActual = async () => {
    const rows = await getRows('ACTUAL', spreadsheetIdActual);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];

    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'neto');
    const indicadoresIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'indicadores');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const subRubroIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'subrubro');
    const rubroIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'rubro');
    const descripcionIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'descripción');

    if (sucursalIdx === -1) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        const indicador = indicadoresIdx !== -1 && row[indicadoresIdx] ? row[indicadoresIdx].toString().trim() : '';
        const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;
        const subRubro = subRubroIdx !== -1 && row[subRubroIdx] ? row[subRubroIdx].toString().trim() : 'Sin SubRubro';
        const descripcion = descripcionIdx !== -1 && row[descripcionIdx] ? row[descripcionIdx].toString().trim() : 'Sin Descripción';
        const fechaRaw = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
        const dateObj = parseDate(fechaRaw);

        if (!isDateInPeriod(dateObj, period, currentYear, currentMonth)) continue;

        if (indicador === '4. Gastos de Operación') {
          gastosOperacionReal += neto;
          const rubro = rubroIdx !== -1 && row[rubroIdx] ? row[rubroIdx].toString().trim() : 'Sin Rubro';
          if (!gastosOpByRubro[rubro]) gastosOpByRubro[rubro] = { real: 0, ppto: 0 };
          gastosOpByRubro[rubro].real += neto;
        }

        if (indicador === '5. Nomina') {
          nominaReal += neto;
          if (!nominaByEmpleado[descripcion]) nominaByEmpleado[descripcion] = { real: 0, ppto: 0 };
          nominaByEmpleado[descripcion].real += neto;
        }

        if (indicador === '3. Costo de Venta') {
          costoVentaReal += neto;
          totalCostoVentaReal += neto;
          // Costo de venta agrupado por SubRubro de ACTUAL (respaldo)
          if (!costoVentaBySubRubro[subRubro]) costoVentaBySubRubro[subRubro] = { real: 0, ppto: 0 };
          costoVentaBySubRubro[subRubro].real += neto;
          // También asignar por descripción como proxy de paquete
          if (!costoVentaByPaquete[subRubro]) costoVentaByPaquete[subRubro] = { real: 0, ppto: 0 };
          costoVentaByPaquete[subRubro].real += neto;
        }
      }
    }
  };

  // --- Procesar PPTO ---
  const procesarPpto = async () => {
    const rows = await getRows('PPTO', spreadsheetIdPpto);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];

    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const pptoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'ppto');
    const indicadoresIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'indicadores');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const subRubroIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'subrubro');
    const descripcionIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'descripción');

    if (sucursalIdx === -1) return;

    // Subrubros excluidos para PPTO
    const subrubrosExcluidosPpto = [
      "Ventas", "Cobranza", "Costo de Venta", "Albumes", "Cuadros", 
      "Pastel", "Fondos", "Material", "Memoria & USB", "Fotografos", 
      "Alicia", "Myrna", "Gastos de Operación", "Activos", "Impuestos Federales"
    ];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Filtrar subrubros excluidos
      if (subRubroIdx !== -1) {
        const subRubroCheck = row[subRubroIdx] ? row[subRubroIdx].toString().trim() : '';
        if (subrubrosExcluidosPpto.includes(subRubroCheck)) continue;
      }

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        const indicador = indicadoresIdx !== -1 && row[indicadoresIdx] ? row[indicadoresIdx].toString().trim() : '';
        const neto = pptoIdx !== -1 ? parseNumber(row[pptoIdx]) : 0;
        const subRubro = subRubroIdx !== -1 && row[subRubroIdx] ? row[subRubroIdx].toString().trim() : 'Sin SubRubro';
        const descripcion = descripcionIdx !== -1 && row[descripcionIdx] ? row[descripcionIdx].toString().trim() : 'Sin Descripción';
        const fechaRaw = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
        const dateObj = parseDate(fechaRaw);

        if (!isDateInPeriod(dateObj, period, currentYear, currentMonth)) continue;

        if (indicador === '4. Gastos de Operación') {
          gastosOperacionPpto += neto;
          if (!gastosOpByRubro[subRubro]) gastosOpByRubro[subRubro] = { real: 0, ppto: 0 };
          gastosOpByRubro[subRubro].ppto += neto;
        }

        if (indicador === '5. Nomina') {
          nominaPpto += neto;
          if (!nominaByEmpleado[descripcion]) nominaByEmpleado[descripcion] = { real: 0, ppto: 0 };
          nominaByEmpleado[descripcion].ppto += neto;
        }

        if (indicador === '3. Costo de Venta') {
          costoVentaPpto += neto;
          pptoCostoVentaTotal += neto;
          if (!costoVentaBySubRubro[subRubro]) costoVentaBySubRubro[subRubro] = { real: 0, ppto: 0 };
          costoVentaBySubRubro[subRubro].ppto += neto;
          if (!costoVentaByPaquete[subRubro]) costoVentaByPaquete[subRubro] = { real: 0, ppto: 0 };
          costoVentaByPaquete[subRubro].ppto += neto;
        }

        if (indicador === '1. Ventas Netas') {
          pptoVentasNetasTotal += neto;
          if (!pptoVentasBySubRubro[subRubro]) pptoVentasBySubRubro[subRubro] = 0;
          pptoVentasBySubRubro[subRubro] += neto;
        }

        if (indicador === '12. Clientes') {
          pptoClientes += neto;
          if (!pptoSesionesByPaquete[subRubro]) pptoSesionesByPaquete[subRubro] = 0;
          pptoSesionesByPaquete[subRubro] += neto;
        }
      }
    }
  };

  // Ejecutar en paralelo
  await Promise.all([
    procesarVentasOtros('VENTAS'),
    procesarVentasOtros('OTROS'),
    procesarGastos(),
    procesarActual(),
    procesarPpto()
  ]);

  // Diagnóstico temporal: SubRubros de PPTO donde Indicadores = "12. Clientes"
  const clientesKeys = Object.keys(pptoSesionesByPaquete).slice(0, 10);
  console.log('\n--- DIAG: PPTO "12. Clientes" por SubRubro ---');
  clientesKeys.forEach((k, i) => console.log(`  ${i + 1}. "${k}" = ${pptoSesionesByPaquete[k]}`));
  console.log(`Total keys: ${Object.keys(pptoSesionesByPaquete).length}`);
  console.log('--- Paquetes de VENTAS/OTROS ---');
  Object.keys(ventasByPaquete).slice(0, 10).forEach((k, i) => console.log(`  ${i + 1}. "${k}"`));
  console.log('-----------------------------------------------\n');

  // --- Construir tablas ---
  const buildSubRubroRows = (map: Record<string, { real: number; ppto: number }>): SubRubroRow[] => {
    return Object.entries(map)
      .map(([subRubro, { real, ppto }]) => ({
        subRubro,
        real,
        ppto,
        desviacion: real - ppto,
        desviacionPct: ppto !== 0 ? ((real - ppto) / ppto) * 100 : 0,
      }))
      .sort((a, b) => b.real - a.real);
  };

  const buildEmpleadoRows = (map: Record<string, { real: number; ppto: number }>): EmpleadoRow[] => {
    return Object.entries(map)
      .map(([empleado, { real, ppto }]) => ({
        empleado,
        real,
        ppto,
        desviacion: real - ppto,
        desviacionPct: ppto !== 0 ? ((real - ppto) / ppto) * 100 : 0,
      }))
      .sort((a, b) => b.real - a.real);
  };

  // Ventas por Paquete con PPTO cruzado
  const ventasPorPaquete: PaqueteRow[] = [];
  const allPaquetes = new Set([...Object.keys(ventasByPaquete), ...Object.keys(pptoVentasBySubRubro), ...Object.keys(pptoSesionesByPaquete)]);
  for (const paquete of allPaquetes) {
    const ventas = ventasByPaquete[paquete] || { sesiones: 0, ingreso: 0 };
    const pptoIngreso = pptoVentasBySubRubro[paquete] || 0;
    const pptoSesiones = pptoSesionesByPaquete[paquete] || 0;
    ventasPorPaquete.push({
      paquete,
      sesiones: ventas.sesiones,
      pptoSesiones,
      desvSesiones: ventas.sesiones - pptoSesiones,
      ingresoReal: ventas.ingreso,
      pptoIngreso,
      desviacion: ventas.ingreso - pptoIngreso,
      desviacionPct: pptoIngreso !== 0 ? ((ventas.ingreso - pptoIngreso) / pptoIngreso) * 100 : 0,
    });
  }
  ventasPorPaquete.sort((a, b) => b.ingresoReal - a.ingresoReal);

  return {
    gastosOperacionReal,
    gastosOperacionPpto,
    nominaReal,
    nominaPpto,
    costoVentaReal,
    costoVentaPpto,

    gastosOperacionDetalle: buildSubRubroRows(gastosOpByRubro),
    nominaDetalle: buildEmpleadoRows(nominaByEmpleado),
    costoVentaDetalle: buildSubRubroRows(costoVentaByPaquete),

    ventasPorPaquete,

    margenBrutoReal: totalIngresosReal - totalCostoVentaReal,
    margenBrutoPpto: pptoVentasNetasTotal - pptoCostoVentaTotal,

    sesionesReales,
    pptoClientes,
  };

  } catch (error) {
    console.error('[gastosMetrics] ERROR en getGastosMetrics:', error);
    return {
      gastosOperacionReal: 0, gastosOperacionPpto: 0,
      nominaReal: 0, nominaPpto: 0,
      costoVentaReal: 0, costoVentaPpto: 0,
      gastosOperacionDetalle: [], nominaDetalle: [], costoVentaDetalle: [],
      ventasPorPaquete: [],
      margenBrutoReal: 0, margenBrutoPpto: 0,
      sesionesReales: 0, pptoClientes: 0,
    };
  }
}
