export interface RegistroAsistencia {
    id_estudiante: string;
    estado: string;
    confianza: number | null;
    fecha_deteccion: string | null;
    modificado_por_usuario?: string | null;
    modificado_fecha?: string | null;
  }
  
  export interface Asistencia {
    fecha: string;
    estado: string;
  }
  
  export interface ResumenAsistencias {
    asistidas: number;
    ausentes: number;
  }
  
  export interface RegistroDetallado {
    Estudiante: string;
    Estado: string;
    "Fecha detección": string | null;
    "Modificado por": string | null;
    "Fecha modificación": string | null;
  }
  
  export interface AsistenciaResumen {
    _id: string;
    fecha: string;
    id_aula: string;
    nombre_aula: string;
    id_clase: string;
    nombre_clase: string;
  }
  
  export interface AsistenciaDetalle extends AsistenciaResumen {
    registros: RegistroDetallado[];
  }