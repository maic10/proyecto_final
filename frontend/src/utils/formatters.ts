// src/utils/formatters.ts
import { formatInTimeZone } from 'date-fns-tz';

export const formatDate = (date: string | null, format: string = 'dd/MM/yyyy HH:mm'): string => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  return formatInTimeZone(dateObj, 'Europe/Madrid', format);
};

export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatTimeRemaining = (ms: number): string => {
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const segundos = Math.floor((ms % (1000 * 60)) / 1000);

  let tiempoRestante = '';
  if (dias > 0) tiempoRestante += `${dias}d `;
  if (horas > 0 || dias > 0) tiempoRestante += `${horas}h `;
  tiempoRestante += `${minutos}m ${segundos}s`;
  return tiempoRestante;
};