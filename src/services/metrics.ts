import { google } from 'googleapis'

export interface MetricsResult {
  ingresoTotal: number;
  totalSesiones: number;
  anticipoAcumulado: number;
  saldoPendiente: number;
  egresoTotal: number;
  margenNeto: number;
  margenPorcentaje: number;
  pptoIngresos: number;
  pptoEgresos: number;
  desviacionIngresos: number;
  desviacionEgresos: number;

  ventasNetas: number;
  egresoResultados: number;
  pptoVentas: number;
  pptoEgresosResultados: number;
  pptoClientes: number;
  desviacionVentas: number;
  desviacionVentasPct: number;

  monthlyData: {
    month: number;
    ventasNetas: number;
    egresoResultados: number;
    pptoVentas: number;
    pptoEgresosResultados: number;
  }[];
}

function parseNumber(value: any): number {
  if (value === undefined || value === null) return 0;
  const str = value.toString().trim();
  if (str === "-" || str === "") return 0;
  
  let cleaned = str.replace(/[\$\s]/g, "");
  
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Formato europeo/mexicano: 1.234,56 → quita puntos, cambia coma por punto
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    // Coma como separador de miles: 4,930 → 4930
    cleaned = cleaned.replace(/,/g, "");
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    // Múltiples puntos como separadores de miles: 1.234.567
    cleaned = cleaned.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(cleaned) && !/\.\d{1,2}$/.test(cleaned.replace(/\.\d{3}$/, ''))) {
    // Un solo punto seguido de exactamente 3 dígitos al final → separador de miles
    // Ej: "1.500" → 1500, "9.000" → 9000
    // Pero NO afecta: "1.5", "1.50" (punto decimal)
    cleaned = cleaned.replace(/\./g, "");
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const s = dateStr.toString().trim();
  if (s === '-' || s === '') return null;
  
  // Formato esperado: DD/MM/YYYY o DD-MM-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
      // Si el primer elemento tiene 4 dígitos, es YYYY-MM-DD
      if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day);
      } else {
          // Asumir DD/MM/YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Meses en Date van de 0 a 11
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000; // Manejar años de 2 dígitos
          return new Date(year, month, day);
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

  if (period === 'ALL_YEAR') {
    return true;
  }
  if (period === 'YTD') {
    return m <= currentMonth;
  }
  if (period === 'CURRENT_MONTH') {
    return m === currentMonth;
  }
  if (period.startsWith('MONTH_')) {
    const targetMonth = parseInt(period.split('_')[1], 10);
    return m === targetMonth;
  }
  return true;
}

export async function getMetricsForSucursal(sucursal: string, period: string = 'YTD'): Promise<MetricsResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const minDate = new Date(currentYear, 0, 1);
  const maxDate = new Date(currentYear, currentMonth + 1, 0); // Último día del mes actual

  // Configurar la autenticación
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Manejo de saltos de línea
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetIdVentas = process.env.GOOGLE_SPREADSHEET_ID;
  const spreadsheetIdActual = process.env.GOOGLE_SPREADSHEET_ID_ACTUAL;
  const spreadsheetIdPpto = process.env.GOOGLE_SPREADSHEET_ID_PPTO;

  if (!spreadsheetIdVentas || !spreadsheetIdActual || !spreadsheetIdPpto || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Faltan credenciales o IDs de Google Sheets en el archivo .env.local');
  }

  let ingresoTotal = 0;
  let totalSesiones = 0;
  let anticipoAcumulado = 0;
  let saldoPendiente = 0;
  let egresoResultados = 0;
  let pptoVentas = 0;
  let pptoEgresosResultados = 0;
  let pptoClientes = 0;



  const monthlyDataRaw: Record<number, {
    ventasNetas: number;
    egresoResultados: number;
    pptoVentas: number;
    pptoEgresosResultados: number;
  }> = {};
  for (let i = 0; i < 12; i++) {
    monthlyDataRaw[i] = { ventasNetas: 0, egresoResultados: 0, pptoVentas: 0, pptoEgresosResultados: 0 };
  }

  async function getRows(sheetName: string, id: string) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        // Al buscar 'sheetName!A:Z' asume que la pestaña dentro del archivo se llama igual. 
        // Si el archivo solo tiene una pestaña genérica, podría fallar. Avisaré al usuario.
        range: `${sheetName}!A:Z`,
      });
      return response.data.values || [];
    } catch (error) {
      console.error(`Error leyendo la hoja ${sheetName} en ID ${id}:`, error);
      return [];
    }
  }

  let egresoGastos = 0;

  // --- 1. Procesar VENTAS y OTROS (Mismo archivo principal) ---
  const procesarVentasOtros = async (sheetName: string) => {
    const rows = await getRows(sheetName, spreadsheetIdVentas);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];
    
    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'neto');
    const anticipoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'anticipo');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const extrasIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'extras');

    if (sucursalIdx === -1) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        // TODO: Filtro de fecha en el futuro usando parseDate(row[fechaIdx])
        
        const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;
        const anticipo = anticipoIdx !== -1 ? parseNumber(row[anticipoIdx]) : 0;
        const extras = extrasIdx !== -1 ? parseNumber(row[extrasIdx]) : 0;

        const fechaOriginal = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
        const dateObj = parseDate(fechaOriginal);



        if (dateObj && dateObj.getFullYear() === currentYear) {
            const m = dateObj.getMonth();
            if (m >= 0 && m < 12) {
                monthlyDataRaw[m].ventasNetas += neto;
            }
        }

        if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
            totalSesiones++;
            ingresoTotal += neto;
            anticipoAcumulado += anticipo;
            saldoPendiente += (neto - anticipo);
        }

      }
    }
  };

  // --- 2. Procesar GASTOS (Mismo archivo principal) ---
  const procesarGastos = async () => {
    const rows = await getRows('GASTOS', spreadsheetIdVentas);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];
    
    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'neto');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');

    if (sucursalIdx === -1) return;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      const fechaRaw = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
      const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;
      const dateObj = parseDate(fechaRaw);

      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
          egresoGastos += neto;
        }
      }
    }
  };

  // --- 3. Procesar ACTUAL y PPTO (Archivos separados) ---
  const procesarActualYPpto = async (sheetName: string, isActual: boolean, id: string) => {
    const rows = await getRows(sheetName, id);
    if (rows.length === 0) return;
    const headers = rows[0] as string[];
    
    const sucursalIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'sucursal');
    const amountColumnName = isActual ? 'neto' : 'ppto';
    const netoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === amountColumnName);
    const indicadoresIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'indicadores');
    const fechaIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fecha');
    const subRubroIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'subrubro');

    if (sucursalIdx === -1) {
      console.warn(`Columna 'Sucursal' faltante en la hoja ${sheetName}. Saltando...`);
      return;
    }

    const egresosIndicadores = [
      "3. Costo de Venta", "4. Gastos de Operación", "5. Nomina", 
      "6. Activos", "7. Depreciacion", "8. Impuestos"
    ];
    const ingresosIndicadores = [
      "1. Ventas Netas", "2. Cobranza", "10. Otros Ingresos"
    ];
    
    const subrubrosExcluidosPpto = [
      "Ventas", "Cobranza", "Costo de Venta", "Albumes", "Cuadros", 
      "Pastel", "Fondos", "Material", "Memoria & USB", "Fotografos", 
      "Alicia", "Myrna", "Gastos de Operación", "Activos", "Impuestos Federales"
    ];



    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      if (!isActual) {
        if (subRubroIdx !== -1) {
          const subRubro = row[subRubroIdx] ? row[subRubroIdx].toString().trim() : '';
          if (subrubrosExcluidosPpto.includes(subRubro)) {
            continue; // Saltamos la fila completamente
          }
        }
      }

      const rowSucursal = row[sucursalIdx] ? row[sucursalIdx].toString().trim() : '';
      
      if (true || rowSucursal === sucursal) { // TEMP: Desactivado filtro de sucursal
        
        const indicador = indicadoresIdx !== -1 && row[indicadoresIdx] ? row[indicadoresIdx].toString().trim() : '';
        const subRubro = subRubroIdx !== -1 && row[subRubroIdx] ? row[subRubroIdx].toString().trim() : '';
        const neto = netoIdx !== -1 ? parseNumber(row[netoIdx]) : 0;



        // TODO: Filtro de fecha usando parseDate(row[fechaIdx])
        
        const validEgresosResultados = ["3. Costo de Venta", "4. Gastos de Operación", "5. Nomina", "7. Depreciacion"];
        const isEgresoResultado = validEgresosResultados.includes(indicador) || (indicador === "8. Impuestos" && subRubro === "ISR");

        if (isActual) {
          if (isEgresoResultado) {
            const fechaOriginal = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
            const dateObj = parseDate(fechaOriginal);
            
            if (dateObj && dateObj.getFullYear() === currentYear) {
                const m = dateObj.getMonth();
                if (m >= 0 && m < 12) {
                    monthlyDataRaw[m].egresoResultados += neto;
                }
            }
            if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
                egresoResultados += neto;
            }
          }
        } else {
          // PPTO acumula presupuesto
          const fechaOriginal = fechaIdx !== -1 && row[fechaIdx] ? row[fechaIdx].toString().trim() : '';
          const dateObj = parseDate(fechaOriginal);
          
          if (indicador === "1. Ventas Netas") {
            if (dateObj && dateObj.getFullYear() === currentYear) {
               const m = dateObj.getMonth();
               if (m >= 0 && m < 12) monthlyDataRaw[m].pptoVentas += neto;
            }
            if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
               pptoVentas += neto;
            }
          }
          if (isEgresoResultado) {
            if (dateObj && dateObj.getFullYear() === currentYear) {
               const m = dateObj.getMonth();
               if (m >= 0 && m < 12) monthlyDataRaw[m].pptoEgresosResultados += neto;
            }
            if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
               pptoEgresosResultados += neto;
            }
          }
          if (indicador === "12. Clientes") {
            if (isDateInPeriod(dateObj, period, currentYear, currentMonth)) {
               pptoClientes += neto;
            }
          }
        }
      }
    }
  };

  // Ejecutar lecturas en paralelo para optimizar tiempo
  await Promise.all([
    procesarVentasOtros('VENTAS'),
    procesarVentasOtros('OTROS'),
    procesarGastos(),
    procesarActualYPpto('ACTUAL', true, spreadsheetIdActual),
    procesarActualYPpto('PPTO', false, spreadsheetIdPpto)
  ]);

  // --- 4. Calcular métricas derivadas ---
  egresoResultados = egresoResultados + egresoGastos; // ACTUAL + GASTOS
  const ventasNetas = ingresoTotal;
  const margenNeto = ventasNetas - egresoResultados;
  const margenPorcentaje = ventasNetas > 0 ? (margenNeto / ventasNetas) * 100 : 0;
  
  const desviacionVentas = ingresoTotal - pptoVentas;
  const desviacionVentasPct = pptoVentas !== 0 ? (desviacionVentas / pptoVentas) * 100 : 0;

  return {
    egresoTotal: egresoResultados, // alias por retrocompatibilidad UI
    pptoIngresos: pptoVentas,
    pptoEgresos: pptoEgresosResultados,
    desviacionIngresos: desviacionVentas,
    desviacionEgresos: 0,

    ingresoTotal,
    totalSesiones,
    anticipoAcumulado,
    saldoPendiente,
    ventasNetas,
    egresoResultados,
    margenNeto,
    margenPorcentaje,
    pptoVentas,
    pptoEgresosResultados,
    pptoClientes,
    desviacionVentas,
    desviacionVentasPct,
    monthlyData: Object.entries(monthlyDataRaw).map(([month, data]) => ({
      month: parseInt(month),
      ...data
    }))
  };
}
