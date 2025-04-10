// src/types/clases.ts
export interface Horario {
    dia: string;
    hora_inicio: string;
    hora_fin: string;
    id_aula: string;
    nombre_aula: string;
  }
  
  export interface Clase {
    id_clase: string;
    id_asignatura: string;
    nombre_asignatura: string;
    horarios: Horario[];
  }