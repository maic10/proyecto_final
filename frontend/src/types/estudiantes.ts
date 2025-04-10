// src/types/estudiantes.ts
  export interface Imagen {
    file_id: string;
    filename: string;
    data: string;
    mimetype: string;
  }
  
  export interface Estudiante {
    id_estudiante: string;
    nombre: string;
    apellido: string;
    ids_clases: string[];
    imagenes: Imagen[];
  }
  
  export interface ClaseAsignada {
    idAsignatura: string;
    idProfesor: string | null;
  }