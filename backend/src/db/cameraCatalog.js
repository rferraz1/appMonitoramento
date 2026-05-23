export const cameraGroups = [
  {
    name: 'BARU PSV - GRUPO 1',
    prefix: 'PSV1',
    cameras: [
      'BARU ANDES_MAQ LEME BORESTE',
      'BARU ANDES_MAQ LEME BOMBORDO',
      'BARU ANES_ESTERN THRUSTER',
      'BARU ANDES_FLUXO DIESEL',
      'BARU ANDES_MCP BORESTE',
      'CAM_MOTORES CENTRAL',
      'CAM_MOTORES CENTRAL',
      'CAM_DP2',
      'CAM_LEME',
      'CAM_MPC MCA BB',
      'CAM_SEP AGUA OLEO',
      'CAM_MCP E MCA BE',
      'CAM_PASS RE',
      'CAM_PASS VANTE',
      'CAM_GB BB',
      'CAM_BOW',
      'CAM_STER',
      'CAM_GB BE',
      'CAM_CCM'
    ]
  },
  {
    name: 'BARU GRUPO 1',
    prefix: 'G1',
    cameras: ['MACU_PASS RE', 'MACU PASS VISAO GERAL', 'MUCU_PASS VANTE']
  },
  {
    name: 'BARU GRUPO 2',
    prefix: 'G2',
    cameras: [
      'BOMBORDO_SINU',
      'ATRIA POPA',
      'BARU ANTARES_BORESTE',
      'POPA_SINU',
      'BORESTE_SINU',
      'BARU ANTARES_POPA',
      'WORK_AREA_TESORO',
      'ATRIA WORK AREA',
      'POPA_TESORO',
      'PROA_TESORO',
      'BARU ANTARES_BOMBORDO',
      'ATRIA PROA'
    ]
  },
  {
    name: 'BARU GRUPO 3',
    prefix: 'G3',
    cameras: [
      'BARU TAURUS_POPA',
      'BARU TAURUS_BORESTE',
      'BARU BEGA_POPA',
      'WORK AREA _SIRIUS',
      'BARU TAURUS_BOMBORDO',
      'BARU VEJA_BOMBORDO',
      'BARU VEGA_BORESTE',
      'POPA SIRIUS',
      'PROA SIRIUS'
    ]
  },
  {
    name: 'BARU GRUPO 4',
    prefix: 'G4',
    cameras: [
      'SURFER 1931 INTERNA',
      'IPORANGA_POPA',
      '1905 - INTERNA',
      'BARU 1930_EXTERNA',
      'WORK_AREA_UBATUBA',
      'PROA_UBATUBA',
      '1930 - INTERNA',
      'IPORANGA_BORESTE',
      'POPA_UBATUBA',
      'IM4 3M-9494',
      'BARU 1931_EXTERNA',
      'BARU 1905_EXTERNO',
      'IPORANGA_BOMBORDO'
    ]
  },
  {
    name: 'BARU GRUPO 5',
    prefix: 'G5',
    cameras: ['1870 - INTERNA', '1870 - EXTERNA', 'BARU 1871_EXTERNA', '1871 - INTERNA']
  }
];

export function excelCodeFor(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

export function totalCatalogCameras() {
  return cameraGroups.reduce((total, group) => total + group.cameras.length, 0);
}
