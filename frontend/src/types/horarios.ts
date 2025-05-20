// src/types/horarios.ts
export interface Horario {
    dia: string;
    hora_inicio: string;
    hora_fin: string;
    id_aula: string;
  }
  
  export interface Clase {
    id_clase: string;
    id_asignatura: string;
    id_usuario: string;
    horarios: Horario[];
  }
  
  export interface Profesor {
    id_usuario: string;
    nombre: string;
  }
  
  export interface Asignatura {
    id_asignatura: string;
    nombre: string;
  }

  export interface Aula {
    id_aula: string;
    nombre: string;
  }