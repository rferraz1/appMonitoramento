export const monthSheets = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export const workbookTemplate = {
  name: 'PLANILHAFINAL.xlsx',
  dashboardSheet: 'Dashboard BI',
  configSheet: 'Configurações',
  occurrencesSheet: 'Ocorrências',
  headerRow: 5,
  dataStartRow: 6,
  monthlySheets: monthSheets,
  columns: {
    date: 'A',
    day: 'B',
    cameraCode: 'C',
    cameraName: 'D',
    vesselLocation: 'E',
    '10:00': 'F',
    '13:00': 'G',
    '16:00': 'H',
    technicalEvent: 'I',
    behavior: 'J',
    responsible: 'K'
  },
  cameraRowStrategy: {
    mode: 'upsert',
    matchBy: ['date', 'cameraCode'],
    insertWhenMissing: true,
    copyFormattingFromNearestCameraRow: true
  },
  occurrencesColumns: {
    date: 'A',
    month: 'B',
    camera: 'C',
    vesselLocation: 'D',
    type: 'E',
    description: 'F',
    responsible: 'G',
    treatmentStatus: 'H'
  },
  statusMap: {
    Online: 'Online',
    Offline: 'Offline',
    Manutenção: 'Manutenção',
    'Sem acesso': 'Não verificado'
  }
};

export function sheetNameForDate(date) {
  const monthIndex = Number(date.slice(5, 7)) - 1;
  return monthSheets[monthIndex] || monthSheets[0];
}

export function cameraCode(cameraId) {
  return `CAM ${String(cameraId).padStart(2, '0')}`;
}

export function mapStatusToWorkbook(status) {
  return workbookTemplate.statusMap[status] || 'Não verificado';
}

export function buildWorkbookOperations(checks) {
  const resolveCode = (check) => check.excel_code || cameraCode(check.camera_id);

  return checks.map((check) => ({
    sheet: sheetNameForDate(check.date),
    match: {
      date: check.date,
      cameraCode: resolveCode(check)
    },
    ensureRow: {
      enabled: true,
      date: check.date,
      cameraCode: resolveCode(check),
      cameraName: check.camera_name,
      vesselLocation: check.vessel_name,
      insertWhenMissing: true
    },
    update: {
      column: workbookTemplate.columns[check.time_slot],
      value: mapStatusToWorkbook(check.status),
      technicalEventColumn: workbookTemplate.columns.technicalEvent,
      behaviorColumn: workbookTemplate.columns.behavior,
      responsibleColumn: workbookTemplate.columns.responsible,
      technicalEvent: check.observation || (check.status === 'Sem acesso' ? 'Sem acesso' : ''),
      behavior: check.behavior_note || '',
      responsible: check.user_name || 'Sistema'
    }
  }));
}

export function buildOccurrenceOperations(checks) {
  const resolveCode = (check) => check.excel_code || cameraCode(check.camera_id);

  return checks
    .filter((check) => check.observation || check.behavior_note || check.status !== 'Online')
    .map((check) => ({
      sheet: workbookTemplate.occurrencesSheet,
      append: {
        date: check.date,
        month: sheetNameForDate(check.date),
        camera: `${resolveCode(check)} - ${check.camera_name}`,
        vesselLocation: check.vessel_name,
        type: check.behavior_note ? 'Comportamento' : 'Evento técnico',
        description: check.behavior_note || check.observation || check.status,
        responsible: check.user_name || 'Sistema',
        treatmentStatus: 'Pendente'
      }
    }));
}

export function buildCameraNameOperations(cameras) {
  return cameras.map((camera) => ({
    sheets: [workbookTemplate.configSheet, ...workbookTemplate.monthlySheets],
    match: {
      cameraCode: camera.excel_code || cameraCode(camera.id)
    },
    update: {
      cameraName: camera.name,
      vesselLocation: camera.vessel_name || camera.location || '',
      activeLabel: camera.active ? 'Ativa' : 'Futura'
    }
  }));
}
