// src/state/api.ts
import axios from 'axios';
import { obtenerToken, obtenerUsuario } from './auth';
import { API_BASE } from '../utils/constants';
import { Horario, Clase, Profesor, Asignatura,Aula } from '../types/horarios';
import { Estudiante } from '../types/estudiantes';

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

export async function obtenerAsistenciasEstudiante(
  idClase: string,
  idEstudiante: string,
  fechaInicio?: string,
  fechaFin?: string
) {
  const token = obtenerToken();
  if (!token) {
    console.error('Token no encontrado. Redirigiendo al login...');
    throw new Error('No se encontró un token de autenticación');
  }

  const params: any = { id_clase: idClase, id_estudiante: idEstudiante };
  if (fechaInicio && fechaFin) {
    params.fecha_inicio = fechaInicio;
    params.fecha_fin = fechaFin;
  }

  try {
    const res = await axios.get(`${API_BASE}/asistencias/estudiante`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return res.data;
  } catch (error) {
    console.error('Error en obtenerAsistenciasEstudiante:', error.response?.data || error.message);
    throw error;
  }
}

export const obtenerEstudiantes = async (classId?: string, includePhotos: boolean = false) => {
  const token = obtenerToken();
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

  const response = await axios.get(`${API_BASE}/estudiantes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
  });
  return response.data;
};

export const subirImagenEstudiante = async (idEstudiante: string, imagen: File) => {
  const token = obtenerToken();
  const formData = new FormData();
  formData.append('imagen', imagen);

  const response = await axios.post(
    `${API_BASE}/estudiantes/${idEstudiante}/subir-imagen`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const crearEstudiante = async (nombre: string, apellido: string, idsClases: string[]) => {
  const token = obtenerToken();
  const response = await axios.post(
    `${API_BASE}/estudiantes/nuevo`,
    { nombre, apellido, ids_clases: idsClases },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const actualizarEstudiante = async (idEstudiante: string, nombre: string, apellido: string, idsClases: string[]) => {
  const token = obtenerToken();
  const response = await axios.put(
    `${API_BASE}/estudiantes/${idEstudiante}`,
    { nombre, apellido, ids_clases: idsClases },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const obtenerEstudiantePorId = async (idEstudiante: string) => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/estudiantes/${idEstudiante}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const eliminarEstudiante = async (idEstudiante: string) => {
  const token = obtenerToken();
  const response = await axios.delete(`${API_BASE}/estudiantes/${idEstudiante}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const eliminarImagenEstudiante = async (idEstudiante: string, fileId: string) => {
  const token = obtenerToken();
  const response = await axios.delete(`${API_BASE}/estudiantes/${idEstudiante}/imagenes/${fileId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const obtenerAsignaturas = async () => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/asignaturas`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const obtenerProfesoresPorAsignatura = async (idAsignatura: string) => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/asignaturas/${idAsignatura}/profesores`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const obtenerClasesAdmin = async (idAsignatura?: string, idUsuario?: string, idClase?: string) => {
  const token = obtenerToken();
  const params: { [key: string]: string | undefined } = {
    id_asignatura: idAsignatura,
    id_usuario: idUsuario,
    id_clase: idClase,
  };

  const response = await axios.get(`${API_BASE}/clases-admin`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
  });
  return response.data;
};

export const obtenerProfesores = async (): Promise<Profesor[]> => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/profesor/profesores`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};


export const obtenerClasePorId = async (idClase: string): Promise<Clase> => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/clases/${idClase}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const actualizarHorarios = async (idClase: string, horarios: Horario[]): Promise<void> => {
  const token = obtenerToken();
  await axios.put(`${API_BASE}/clases/${idClase}/horarios`, { horarios }, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

export const obtenerAulas = async (): Promise<Aula[]> => {
  const token = obtenerToken();
  const response = await axios.get(`${API_BASE}/aulas`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const filtrarEstudiantes = async (
  idProfesor?: string,
  idAsignatura?: string,
  incluirFoto: boolean = false
): Promise<Estudiante[]> => {
  try {
    const token = obtenerToken();
    const params: any = { incluir_foto: incluirFoto.toString() };
    if (idProfesor) params.id_profesor = idProfesor;
    if (idAsignatura) params.id_asignatura = idAsignatura;

    const response = await axios.get(`${API_BASE}/estudiantes/filtrar`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data || [];
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