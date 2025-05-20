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

// Permite iniciar sesión
export async function iniciarSesion(correo: string, contraseña: string) {
  const res = await axiosInstance.post('/autenticacion/iniciar_sesion', {
    correo,
    contraseña
  });
  return res;
}

// Obtener el perfil del usuario autenticado
export async function obtenerPerfil() {
  const res = await axiosInstance.get('/autenticacion/perfil');
  return res;
}

// Obtener las clases del usuario autenticado
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

// Obtener asistencias por clase
export async function obtenerAsistencias(idClase: string) {
  const res = await axiosInstance.get(`/asistencias/${idClase}`);
  return res;
}

// Obtener asistencias actuales
export async function obtenerAsistenciasActual(idClase: string, fecha: string) {
  const params = { id_clase: idClase, fecha };
  const res = await axiosInstance.get('/asistencias/actual', { params });
  return res;
}

// Actualizar el estado de asistencia de un estudiante
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

// Obtener el estado de la transmisión
export async function verificarEstadoTransmision(idClase: string) {
  const params = { id_clase: idClase };
  const res = await axiosInstance.get('/transmision/estado_web', { params });
  return res;
}

// Obtener asistencias de un estudiante
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

// Obtener datos de un estudiante (incluyendo foto)
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

// Guardar la imagen de un estudiante
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

// Dar de alta un nuevo estudiante
export const crearEstudiante = async (nombre: string, apellido: string, idsClases: string[]) => {
  const res = await axiosInstance.post('/estudiantes/nuevo', { nombre, apellido, ids_clases: idsClases });
  return res;
};

// Actualizar los datos de un estudiante
export const actualizarEstudiante = async (idEstudiante: string, nombre: string, apellido: string, idsClases: string[]) => {
  const res = await axiosInstance.put(`/estudiantes/${idEstudiante}`, { nombre, apellido, ids_clases: idsClases });
  return res;
};

// Obtener los datos de un estudiante por su ID
export const obtenerEstudiantePorId = async (idEstudiante: string) => {
  const res = await axiosInstance.get(`/estudiantes/${idEstudiante}`);
  return res;
};

// Eliminar un estudiante
export const eliminarEstudiante = async (idEstudiante: string) => {
  const res = await axiosInstance.delete(`/estudiantes/${idEstudiante}`);
  return res;
};

// Eliminar la imagen de un estudiante
export const eliminarImagenEstudiante = async (idEstudiante: string, fileId: string) => {
  const res = await axiosInstance.delete(`/estudiantes/${idEstudiante}/imagenes/${fileId}`);
  return res;
};

// Obtener las asignaturas disponibles
export const obtenerAsignaturas = async () => {
  const res = await axiosInstance.get('/asignaturas');
  return res;
};

// Obtener los profesores de una asignatura
export const obtenerProfesoresPorAsignatura = async (idAsignatura: string) => {
  const res = await axiosInstance.get(`/asignaturas/${idAsignatura}/profesores`);
  return res;
};

// Obtener clases basadas en asignatura, profesor o ID de clase (para administradores)
export const obtenerClasesAdmin = async (idAsignatura?: string, idUsuario?: string, idClase?: string) => {
  const params: { [key: string]: string | undefined } = {
    id_asignatura: idAsignatura,
    id_usuario: idUsuario,
    id_clase: idClase,
  };

  const res = await axiosInstance.get('/clases-admin', { params });
  return res;
};

// Obtener los datos de los profesores
export const obtenerProfesores = async (): Promise<Profesor[]> => {
  const res = await axiosInstance.get('/profesor/profesores');
  return res;
};

// Obtener los datos de una clase por su ID
export const obtenerClasePorId = async (idClase: string): Promise<Clase> => {
  const res = await axiosInstance.get(`/clases/${idClase}`);
  return res;
};

// Actualizar los horarios de una clase
export const actualizarHorarios = async (idClase: string, horarios: Horario[]): Promise<void> => {
  await axiosInstance.put(`/clases/${idClase}/horarios`, { horarios });
};

// Obtener las aulas disponibles
export const obtenerAulas = async (): Promise<Aula[]> => {
  const res = await axiosInstance.get('/aulas');
  return res;
};

// Filtrar estudiantes por profesor y/o asignatura (solo para administradores)
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

// Obtener las clases de un profesor específico
export const obtenerClasesPorProfesor = async (profesorId: string): Promise<Clase[]> => {
  return await obtenerClasesAdmin(undefined, profesorId, undefined);
};

// Obtener las clases de una asignatura específica
export const obtenerClasesPorAsignatura = async (asignaturaId: string): Promise<Clase[]> => {
  return await obtenerClasesAdmin(asignaturaId, undefined, undefined);
};

// Permite ajustar el tiempo máximo para detecciones a tiempo.
export const ajustarTiempoMaximo = async (idClase: string, tiempoMaximo: number) => {
  const response = await axiosInstance.post(`/transmision/tiempo_maximo/${idClase}`, {
    tiempo_maximo: tiempoMaximo,
  });
  return response.data;
};

// Cambiar la contraseña del usuario autenticado
export async function cambiarContrasena(contrasenaActual: string, nuevaContrasena: string) {
  const res = await axiosInstance.post('/autenticacion/cambiar_contrasena', {
    contrasenaActual,
    nuevaContrasena
  });
  return res;
}