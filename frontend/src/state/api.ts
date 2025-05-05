// src/state/api.ts
import axios from 'axios';
import { obtenerToken, obtenerUsuario, cerrarSesion } from './auth';
import { API_BASE } from '../utils/constants';
import { Horario, Clase, Profesor, Aula } from '../types/horarios';
import { Estudiante } from '../types/estudiantes';

// Crear una instancia de axios
const axiosInstance = axios.create({
  baseURL: API_BASE,
});

// Interceptor de solicitud: Añadir el token a las solicitudes
axiosInstance.interceptors.request.use(
  (config) => {
    const token = obtenerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta: Manejar errores 401
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Cerrar sesión y redirigir al login
      cerrarSesion();
      window.location.href = '/'; 
      return new Promise(() => {});
    }
    return Promise.reject(error);
  }
);

export async function iniciarSesion(correo: string, contraseña: string) {
  const res = await axiosInstance.post('/autenticacion/iniciar_sesion', {
    correo,
    contraseña
  });
  return res;
}

export async function obtenerPerfil() {
  const res = await axiosInstance.get('/autenticacion/perfil');
  return res;
}

export async function obtenerClases(id_usuario: string) {
  const params = { id_usuario };
  const res = await axiosInstance.get('/clases', { params });
  return res;
}

 // Para obtener estudiantes de una clase
export async function obtenerEstudiantesPorClase(id_clase: string) {
  const params = { class_id: id_clase };
  const res = await axiosInstance.get('/estudiantes', { params });
  return res;
}

// Obtener las asistencias listadas (resumen)
export async function obtenerAsistenciasListado(
  fechaInicio?: string,
  fechaFin?: string,
  idClase?: string
) {
  const params: any = {};
  if (fechaInicio && fechaFin) {
    params.fecha_inicio = fechaInicio;
    params.fecha_fin = fechaFin;
  }
  if (idClase) {
    params.id_clase = idClase;
  }

  const res = await axiosInstance.get('/asistencias/listado', { params });
  return res;
}

// Obtener los detalles de una asistencia
export async function obtenerAsistenciaDetalle(idClase: string, fecha: string) {
  const params = {
    id_clase: idClase,
    fecha: fecha
  };
  const res = await axiosInstance.get('/asistencias/detalle', { params });
  return res;
}

// Exportar asistencias a CSV o Excel
export async function exportarAsistencias(
  fechaInicio?: string,
  fechaFin?: string,
  idClase?: string,
  formato: 'xlsx' | 'csv' = 'xlsx'
) {
  const params: any = {
    formato: formato
  };
  if (idClase) {
    params.id_clase = idClase;
  }
  if (fechaInicio && fechaFin) {
    params.fecha_inicio = fechaInicio;
    params.fecha_fin = fechaFin;
  }

  const res = await axiosInstance.get('/asistencias/exportar', {
    responseType: 'blob',
    params
  });
  return res;
}

export async function obtenerAsistencias(idClase: string) {
  const res = await axiosInstance.get(`/asistencias/${idClase}`);
  return res;
}

export async function obtenerAsistenciasActual(idClase: string, fecha: string) {
  const params = { id_clase: idClase, fecha };
  const res = await axiosInstance.get('/asistencias/actual', { params });
  return res;
}

export const actualizarEstadoAsistencia = async (
  idEstudiante: string,
  idClase: string,
  fecha: string,
  nuevoEstado: string
): Promise<void> => {
  const usuario = obtenerUsuario();
  const fechaModificacion = new Date().toISOString();

  await axiosInstance.put(`/asistencias/${idEstudiante}`, {
    id_clase: idClase,
    fecha,
    estado: nuevoEstado,
    modificado_por_usuario: usuario?.id_usuario || 'desconocido',
    modificado_fecha: fechaModificacion,
  });
};

export async function verificarEstadoTransmision(idClase: string) {
  const params = { id_clase: idClase };
  const res = await axiosInstance.get('/transmision/estado_web', { params });
  return res;
}

export async function obtenerAsistenciasEstudiante(
  idClase: string,
  idEstudiante: string,
  fechaInicio?: string,
  fechaFin?: string
) {
  const params: any = { id_clase: idClase, id_estudiante: idEstudiante };
  if (fechaInicio && fechaFin) {
    params.fecha_inicio = fechaInicio;
    params.fecha_fin = fechaFin;
  }

  try {
    const res = await axiosInstance.get('/asistencias/estudiante', { params });
    return res;
  } catch (error) {
    console.error('Error en obtenerAsistenciasEstudiante:', error.response?.data || error.message);
    throw error;
  }
}

export const obtenerEstudiantes = async (classId?: string, includePhotos: boolean = false) => {
  const usuario = obtenerUsuario();

  if (!usuario) {
    throw new Error('Usuario no autenticado');
  }

  const params: { [key: string]: string | boolean } = {
    incluir_foto: includePhotos,
  };

  if (usuario.rol === 'profesor' && classId) {
    params.class_id = classId;
  }

  const res = await axiosInstance.get('/estudiantes', { params });
  return res;
};

export const subirImagenEstudiante = async (idEstudiante: string, imagen: File) => {
  const formData = new FormData();
  formData.append('imagen', imagen);

  const res = await axiosInstance.post(`/estudiantes/${idEstudiante}/subir-imagen`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res;
};

export const crearEstudiante = async (nombre: string, apellido: string, idsClases: string[]) => {
  const res = await axiosInstance.post('/estudiantes/nuevo', { nombre, apellido, ids_clases: idsClases });
  return res;
};

export const actualizarEstudiante = async (idEstudiante: string, nombre: string, apellido: string, idsClases: string[]) => {
  const res = await axiosInstance.put(`/estudiantes/${idEstudiante}`, { nombre, apellido, ids_clases: idsClases });
  return res;
};

export const obtenerEstudiantePorId = async (idEstudiante: string) => {
  const res = await axiosInstance.get(`/estudiantes/${idEstudiante}`);
  return res;
};

export const eliminarEstudiante = async (idEstudiante: string) => {
  const res = await axiosInstance.delete(`/estudiantes/${idEstudiante}`);
  return res;
};

export const eliminarImagenEstudiante = async (idEstudiante: string, fileId: string) => {
  const res = await axiosInstance.delete(`/estudiantes/${idEstudiante}/imagenes/${fileId}`);
  return res;
};

export const obtenerAsignaturas = async () => {
  const res = await axiosInstance.get('/asignaturas');
  return res;
};

export const obtenerProfesoresPorAsignatura = async (idAsignatura: string) => {
  const res = await axiosInstance.get(`/asignaturas/${idAsignatura}/profesores`);
  return res;
};

export const obtenerClasesAdmin = async (idAsignatura?: string, idUsuario?: string, idClase?: string) => {
  const params: { [key: string]: string | undefined } = {
    id_asignatura: idAsignatura,
    id_usuario: idUsuario,
    id_clase: idClase,
  };

  const res = await axiosInstance.get('/clases-admin', { params });
  return res;
};

export const obtenerProfesores = async (): Promise<Profesor[]> => {
  const res = await axiosInstance.get('/profesor/profesores');
  return res;
};


export const obtenerClasePorId = async (idClase: string): Promise<Clase> => {
  const res = await axiosInstance.get(`/clases/${idClase}`);
  return res;
};

export const actualizarHorarios = async (idClase: string, horarios: Horario[]): Promise<void> => {
  await axiosInstance.put(`/clases/${idClase}/horarios`, { horarios });
};

export const obtenerAulas = async (): Promise<Aula[]> => {
  const res = await axiosInstance.get('/aulas');
  return res;
};

export const filtrarEstudiantes = async (
  idProfesor?: string,
  idAsignatura?: string,
  incluirFoto: boolean = false
): Promise<Estudiante[]> => {
  try {
    const params: any = { incluir_foto: incluirFoto.toString() };
    if (idProfesor) params.id_profesor = idProfesor;
    if (idAsignatura) params.id_asignatura = idAsignatura;

    const res = await axiosInstance.get('/estudiantes/filtrar', { params });
    return res || [];
  } catch (err: any) {
    console.error('Error al filtrar estudiantes:', err);
    return [];
  }
};

export const obtenerClasesPorProfesor = async (profesorId: string): Promise<Clase[]> => {
  return await obtenerClasesAdmin(undefined, profesorId, undefined);
};

export const obtenerClasesPorAsignatura = async (asignaturaId: string): Promise<Clase[]> => {
  return await obtenerClasesAdmin(asignaturaId, undefined, undefined);
};

export const ajustarTiempoMaximo = async (idClase: string, tiempoMaximo: number) => {
  const response = await axiosInstance.post(`/transmision/tiempo_maximo/${idClase}`, {
    tiempo_maximo: tiempoMaximo,
  });
  return response.data;
};

export async function cambiarContrasena(contrasenaActual: string, nuevaContrasena: string) {
  const res = await axiosInstance.post('/autenticacion/cambiar_contrasena', {
    contrasenaActual,
    nuevaContrasena
  });
  return res;
}
//export async function obtenerStreamVideo(idClase: string) {
//  const res = await axiosInstance.get(`/transmision/video/${idClase}`, {
//    responseType: 'blob', // Obtener la respuesta como un blob para el stream
//  });
//  return res; // Devuelve el blob directamente
//}