// src/types/auth.ts
export interface Usuario {
    id_usuario: string;
    email: string;
    rol: 'profesor' | 'admin';
  }