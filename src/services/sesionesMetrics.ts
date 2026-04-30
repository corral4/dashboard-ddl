import { google } from 'googleapis'

// --- Interfaces ---
export interface SesionCita {
  fecha: string;       // DD/MM/YYYY
  horaInicio: string;  // HH:MM
  horaFinal: string;   // HH:MM
  titulo: string;
  paqueteNum: string;
  paqueteNombre: string;
  precioEsperado: number;
  realizada: boolean;
  cancelada: boolean;
  calendario: 'cal1' | 'cal2';
}

export interface PaqueteConversion {
  paquete: string;
  citasAgendadas: number;
  sesionesReales: number;
  conversionPct: number;
  ingresoEsperado: number;
  ingresoReal: number;
  diferencia: number;
}

export interface CalendarDayData {
  date: string;  // YYYY-MM-DD
  citas: number;
  ingresoEsperado: number;
}

export interface SesionesMetricsResult {
  // KPIs
  totalCitasAgendadas: number;
  totalCanceladas: number;
  canceladasPct: number;
  totalSesionesRealizadas: number;
  tasaConversion: number;
  ingresoEsperado: number;
  ingresoReal: number;

  // Tabla por paquete
  porPaquete: PaqueteConversion[];

  // Tabla detallada
  citas: SesionCita[];

  // Calendario visual (año completo, sin canceladas)
  calendarData: CalendarDayData[];

  // Ventas por día para filtro interactivo
  ventasByDay: Record<string, Record<string, { sesiones: number; ingreso: number }>>;
}

// --- Parsers (idénticos a metrics.ts) ---
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

function parseDatetime(dtStr: string | undefined): Date | null {
  if (!dtStr) return null;
  const s = dtStr.toString().trim();
  if (s === '-' || s === '') return null;

  // Try standard ISO or JS-parseable format first
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // Try "DD/MM/YYYY HH:MM" or "DD/MM/YYYY HH:MM:SS"
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(match[2], 10) - 1, parseInt(match[1], 10), parseInt(match[4], 10), parseInt(match[5], 10), parseInt(match[6] || '0', 10));
  }

  // Fallback to parseDate (date-only)
  return parseDate(s);
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

function formatDateStr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- Función principal ---
export async function getSesionesMetrics(sucursal: string, period: string = 'YTD', calFilter: 'all' | 'cal1' | 'cal2' = 'all'): Promise<SesionesMetricsResult> {
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
  const calendarId1 = process.env.GOOGLE_CALENDAR1_ID;
  const calendarId2 = process.env.GOOGLE_CALENDAR2_ID;
  // PAQ2 lives in the same file as ACTUAL/PPTO
  const spreadsheetIdActual = process.env.GOOGLE_SPREADSHEET_ID_ACTUAL!;

  // Diagnóstico de variables de entorno
  console.log('\n--- DIAG ENV VARS (Sesiones) ---');
  console.log(`GOOGLE_SPREADSHEET_ID:       ${spreadsheetIdVentas ? spreadsheetIdVentas.substring(0, 8) + '...' : 'NO DEFINIDA'}`);
  console.log(`GOOGLE_SPREADSHEET_ID_ACTUAL: ${spreadsheetIdActual ? spreadsheetIdActual.substring(0, 8) + '...' : 'NO DEFINIDA'}`);
  console.log(`GOOGLE_CALENDAR1_ID:         ${calendarId1 ? calendarId1.substring(0, 8) + '...' : 'NO DEFINIDA'}`);
  console.log(`GOOGLE_CALENDAR2_ID:         ${calendarId2 ? calendarId2.substring(0, 8) + '...' : 'NO DEFINIDA'}`);
  console.log('--- FIN DIAG ENV ---\n');

  async function getRows(sheetName: string, id: string) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: `${sheetName}!A:Z`,
      });
      return response.data.values || [];
    } catch (error: any) {
      console.error(`Error leyendo hoja "${sheetName}" con spreadsheetId="${id?.substring(0, 8)}...":`, error?.message || error);
      return [];
    }
  }

  // --- 1. Leer PAQ2 para catálogo de paquetes ---
  const paq2Map: Record<string, { nombre: string; precio: number }> = {};
  const paq2RawSamples: string[] = [];
  const procesarPaq2 = async () => {
    console.log(`\nDIAG PAQ2: Intentando leer hoja "PAQ2" de spreadsheetId="${spreadsheetIdActual?.substring(0, 8)}..."`);
    const rows = await getRows('PAQ2', spreadsheetIdActual);
    if (rows.length === 0) { console.log('DIAG PAQ2: hoja vacía o error de lectura'); return; }
    const headers = rows[0] as string[];
    console.log('\n--- DIAG PAQ2 ---');
    console.log('Headers:', headers.map((h, i) => `[${i}]="${h}"`).join(', '));

    const numIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'num');
    const paqIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'paquete');
    const precioIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase().replace(/\s+/g, '') === 'preciosiniva');
    console.log(`numIdx=${numIdx}, paqIdx=${paqIdx}, precioIdx=${precioIdx}`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const rawNum = numIdx !== -1 && row[numIdx] ? row[numIdx].toString() : '';
      const num = rawNum.trim();
      const nombre = paqIdx !== -1 && row[paqIdx] ? row[paqIdx].toString().trim() : '';
      const precio = precioIdx !== -1 ? parseNumber(row[precioIdx]) : 0;
      if (paq2RawSamples.length < 5) paq2RawSamples.push(`raw="${rawNum}" trimmed="${num}" nombre="${nombre}" precio=${precio}`);
      if (num) paq2Map[num] = { nombre, precio };
    }
    console.log('Primeros 5 Num de PAQ2:');
    paq2RawSamples.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log(`Total PAQ2 keys: ${Object.keys(paq2Map).length}`);
    console.log('PAQ2 map keys:', Object.keys(paq2Map).join(', '));
    console.log('--- FIN DIAG PAQ2 ---\n');
  };

  // --- 2. Leer calendarios ---
  const allCitas: SesionCita[] = [];
  const procesarCalendario = async (calId: string | undefined, calTag: 'cal1' | 'cal2') => {
    if (!calId) { console.log(`DIAG ${calTag}: ID no configurado (env var vacía)`); return; }
    console.log(`DIAG ${calTag}: ID="${calId.substring(0, 10)}..." (${calId.length} chars)`);
    let rows: any[][] = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: calId,
        range: 'A:Z',
      });
      rows = response.data.values || [];
      console.log(`DIAG ${calTag}: Sheet leído OK, ${rows.length} filas (incluyendo header)`);
    } catch (error) {
      console.error(`Error leyendo calendario ${calTag} (ID=${calId.substring(0, 10)}...):`, error);
      return;
    }
    if (rows.length === 0) return;
    const headers = rows[0] as string[];

    const eventoIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'evento');
    const inicioIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'inicio');
    const finIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fin');
    const colorIdx = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'color');

    console.log(`\n--- DIAG ${calTag.toUpperCase()} ---`);
    console.log('Headers:', headers.map((h, i) => `[${i}]="${h}"`).join(', '));
    console.log(`eventoIdx=${eventoIdx}, inicioIdx=${inicioIdx}, finIdx=${finIdx}, colorIdx=${colorIdx}`);
    const colorSamples: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const inicioRaw = inicioIdx !== -1 && row[inicioIdx] ? row[inicioIdx].toString().trim() : '';
      const dateObj = parseDatetime(inicioRaw);

      // Recoger samples ANTES del filtro de fecha para ver todos los valores
      if (colorSamples.length < 5) {
        const rawColor = colorIdx !== -1 && row[colorIdx] ? row[colorIdx].toString() : '(vacío)';
        const rawEvento = eventoIdx !== -1 && row[eventoIdx] ? row[eventoIdx].toString() : '';
        colorSamples.push(`Color raw="${rawColor}" trimmed="${rawColor.trim()}" evento="${rawEvento}" inicio="${inicioRaw}"`);
      }

      if (!isDateInPeriod(dateObj, period, currentYear, currentMonth)) continue;

      const finRaw = finIdx !== -1 && row[finIdx] ? row[finIdx].toString().trim() : '';
      const finDate = parseDatetime(finRaw);
      const colorNum = colorIdx !== -1 && row[colorIdx] ? row[colorIdx].toString().trim() : '';
      const paqInfo = paq2Map[colorNum] || { nombre: `Paquete ${colorNum || '?'}`, precio: 0 };

      allCitas.push({
        fecha: dateObj ? formatDateStr(dateObj) : '',
        horaInicio: dateObj ? formatTime(dateObj) : '',
        horaFinal: finDate ? formatTime(finDate) : '',
        titulo: eventoIdx !== -1 && row[eventoIdx] ? row[eventoIdx].toString().trim() : '',
        paqueteNum: colorNum,
        paqueteNombre: paqInfo.nombre,
        precioEsperado: paqInfo.precio,
        realizada: false,
        cancelada: false, // se marca después
        calendario: calTag,
      });
    }
    console.log('Primeros 5 Color crudos:');
    colorSamples.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log(`Total filas en ${calTag}: ${rows.length - 1}`);
    // Intento de cruce manual con el primer Color
    if (colorSamples.length > 0) {
      const firstRaw = colorIdx !== -1 && rows[1] && rows[1][colorIdx] ? rows[1][colorIdx].toString().trim() : '';
      const found = paq2Map[firstRaw];
      console.log(`Cruce manual: Color="${firstRaw}" → PAQ2 encontrado: ${found ? `SI → "${found.nombre}" $${found.precio}` : `NO — keys disponibles: [${Object.keys(paq2Map).join(', ')}]`}`);
    }
    console.log(`--- FIN DIAG ${calTag.toUpperCase()} ---\n`);
  };

  // --- 3. Leer VENTAS + OTROS para sesiones reales ---
  const ventasReales: Record<string, { sesiones: number; ingreso: number }> = {};
  const ventasFechasPaquetes = new Set<string>(); // "YYYY-MM-DD|paquete" para cruce
  const ventasByDay: Record<string, Record<string, { sesiones: number; ingreso: number }>> = {};
  let totalSesionesRealizadas = 0;
  let ingresoReal = 0;

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

        if (!isDateInPeriod(dateObj, period, currentYear, currentMonth)) continue;

        totalSesionesRealizadas++;
        ingresoReal += neto;

        if (!ventasReales[paquete]) ventasReales[paquete] = { sesiones: 0, ingreso: 0 };
        ventasReales[paquete].sesiones++;
        ventasReales[paquete].ingreso += neto;

        // Key for matching: date + paquete name
        if (dateObj) {
          const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          ventasFechasPaquetes.add(`${dateKey}|${paquete.toLowerCase()}`);
          if (!ventasByDay[dateKey]) ventasByDay[dateKey] = {};
          if (!ventasByDay[dateKey][paquete]) ventasByDay[dateKey][paquete] = { sesiones: 0, ingreso: 0 };
          ventasByDay[dateKey][paquete].sesiones++;
          ventasByDay[dateKey][paquete].ingreso += neto;
        }
      }
    }
  };

  // --- Ejecutar en paralelo ---
  await procesarPaq2(); // PAQ2 primero para tener el catálogo
  await Promise.all([
    procesarCalendario(calendarId1, 'cal1'),
    procesarCalendario(calendarId2, 'cal2'),
    procesarVentasOtros('VENTAS'),
    procesarVentasOtros('OTROS'),
  ]);

  // --- 4. Cruzar citas con ventas para marcar "realizada" ---
  for (const cita of allCitas) {
    const parts = cita.fecha.split('/');
    if (parts.length === 3) {
      const dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const matchKey = `${dateKey}|${cita.paqueteNombre.toLowerCase()}`;
      if (ventasFechasPaquetes.has(matchKey)) {
        cita.realizada = true;
      }
    }
  }

  // --- 5. Filtrar por calendario si se solicita ---
  const citasFiltradas = calFilter === 'all' ? allCitas : allCitas.filter(c => c.calendario === calFilter);

  // Marcar canceladas (Color = "11")
  for (const cita of citasFiltradas) {
    cita.cancelada = cita.paqueteNum === '11';
  }

  const totalAllCitas = citasFiltradas.length;
  const totalCanceladas = citasFiltradas.filter(c => c.cancelada).length;
  const canceladasPct = totalAllCitas > 0 ? (totalCanceladas / totalAllCitas) * 100 : 0;
  const citasActivas = citasFiltradas.filter(c => !c.cancelada);

  // --- 6. Construir tabla por paquete (solo citas activas) ---
  const citasPorPaquete: Record<string, { citas: number; ingresoEsperado: number }> = {};
  for (const cita of citasActivas) {
    const key = cita.paqueteNombre;
    if (!citasPorPaquete[key]) citasPorPaquete[key] = { citas: 0, ingresoEsperado: 0 };
    citasPorPaquete[key].citas++;
    citasPorPaquete[key].ingresoEsperado += cita.precioEsperado;
  }

  const allPaquetes = new Set([...Object.keys(citasPorPaquete), ...Object.keys(ventasReales)]);
  const porPaquete: PaqueteConversion[] = [];
  for (const paq of allPaquetes) {
    const citas = citasPorPaquete[paq] || { citas: 0, ingresoEsperado: 0 };
    const ventas = ventasReales[paq] || { sesiones: 0, ingreso: 0 };
    porPaquete.push({
      paquete: paq,
      citasAgendadas: citas.citas,
      sesionesReales: ventas.sesiones,
      conversionPct: citas.citas > 0 ? (ventas.sesiones / citas.citas) * 100 : 0,
      ingresoEsperado: citas.ingresoEsperado,
      ingresoReal: ventas.ingreso,
      diferencia: ventas.ingreso - citas.ingresoEsperado,
    });
  }
  porPaquete.sort((a, b) => b.citasAgendadas - a.citasAgendadas);

  // --- 7. KPIs (sobre citas activas, sin canceladas) ---
  const totalCitasAgendadas = citasActivas.length;
  const tasaConversion = totalCitasAgendadas > 0 ? (totalSesionesRealizadas / totalCitasAgendadas) * 100 : 0;
  const ingresoEsperado = citasActivas.reduce((s, c) => s + c.precioEsperado, 0);

  // Ordenar citas por fecha descendente
  citasFiltradas.sort((a, b) => {
    const da = a.fecha.split('/').reverse().join('');
    const db = b.fecha.split('/').reverse().join('');
    if (da !== db) return db.localeCompare(da);
    return b.horaInicio.localeCompare(a.horaInicio);
  });

  // --- 8. Construir datos de calendario (año completo, sin canceladas, sin filtro de período) ---
  const calendarMap: Record<string, { citas: number; ingreso: number }> = {};
  const allCitasForCalendar = (calFilter === 'all' ? allCitas : allCitas.filter(c => c.calendario === calFilter))
    .filter(c => c.paqueteNum !== '11'); // excluir canceladas
  for (const cita of allCitasForCalendar) {
    const parts = cita.fecha.split('/');
    if (parts.length === 3) {
      const key = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
      if (!calendarMap[key]) calendarMap[key] = { citas: 0, ingreso: 0 };
      calendarMap[key].citas++;
      calendarMap[key].ingreso += cita.precioEsperado;
    }
  }
  const calendarData: CalendarDayData[] = Object.entries(calendarMap)
    .map(([date, { citas, ingreso }]) => ({ date, citas, ingresoEsperado: ingreso }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCitasAgendadas,
    totalCanceladas,
    canceladasPct,
    totalSesionesRealizadas,
    tasaConversion,
    ingresoEsperado,
    ingresoReal,
    porPaquete,
    citas: citasFiltradas,
    calendarData,
    ventasByDay,
  };
}
