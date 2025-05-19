// src/utils/constants.ts
export const API_BASE = 'http://192.168.1.18:5000/api';

export const DIAS_SEMANA = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const TIMEZONE = 'Europe/Madrid';

export const ESTADOS_ASISTENCIA = {
  CONFIRMADO: 'confirmado',
  AUSENTE: 'ausente',
} as const;