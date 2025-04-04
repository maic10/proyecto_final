import axios from 'axios';
import { obtenerToken } from './auth';

const API_BASE = 'http://127.0.0.1:5000/api';


export async function iniciarSesion(correo: string, contraseña: string) {
  const res = await axios.post(`${API_BASE}/autenticacion/iniciar_sesion`, {
    correo,
    contraseña
  });
  return res.data;
}

export async function obtenerPerfil() {
    const token = obtenerToken();
    const res = await axios.get(`${API_BASE}/autenticacion/perfil`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
}

export async function obtenerClases(id_usuario: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/clases?id_usuario=${id_usuario}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

 // Para obtener estudiantes de una clase
export async function obtenerEstudiantesPorClase(id_clase: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/estudiantes?class_id=${id_clase}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function obtenerHistorialAsistencias(id_clase: string, fecha_inicio: string, fecha_fin: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/asistencias/historial`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      clase: id_clase,
      fecha_inicio,
      fecha_fin
    }
  });
  // res.data ya es la lista con { Fecha, Clase, Aula, Estudiante, ... }
  return res.data;
}

export async function obtenerAsistenciasResumen(
  idClase: string, 
  fechaInicio?: string, 
  fechaFin?: string
) {
  const token = obtenerToken();
  const params: any = { id_clase: idClase };
  if (fechaInicio && fechaFin) {
    params.fecha_inicio = fechaInicio;
    params.fecha_fin = fechaFin;
  }

  const res = await axios.get(`${API_BASE}/asistencias/resumen`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return res.data; 
}

export async function obtenerAsistenciaDetalle(idClase: string, fecha: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/asistencias/detalle`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      id_clase: idClase,
      fecha: fecha
    }
  });
  return res.data; // Objeto { id_clase, fecha, id_aula, nombre_clase, nombre_aula, registros: [...] }
}

// NUEVA FUNCIÓN PARA EXPORTAR
export async function exportarAsistenciasExcel(
  idClase: string, 
  fechaInicio: string, 
  fechaFin: string
) {
  const token = obtenerToken();
  // Llamamos al endpoint, indicando 'responseType: blob' para recibir el archivo
  const res = await axios.get(`${API_BASE}/asistencias/exportar`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
    params: {
      id_clase: idClase,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    }
  });

  // Creamos un objeto Blob e iniciamos la descarga
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'asistencias.xlsx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function obtenerAsistencias(idClase: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/asistencias/${idClase}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function obtenerAsistenciasActual(idClase: string, fecha: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/asistencias/actual`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { id_clase: idClase, fecha }
  });
  return res.data;
}

export async function actualizarEstadoAsistencia(idEstudiante: string, idClase: string, fecha: string, estado: string) {
  const token = obtenerToken();
  const res = await axios.put(
    `${API_BASE}/asistencias/${idEstudiante}`,
    { id_clase: idClase, fecha, estado },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function verificarEstadoTransmision(idClase: string) {
  const token = obtenerToken();
  const res = await axios.get(`${API_BASE}/estado_web`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { id_clase: idClase }
  });
  return res.data;
}