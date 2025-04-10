// src/state/auth.ts

const TOKEN_KEY = 'token';
const USER_ID_KEY = 'id_usuario';
const ROL_KEY = 'rol';

export function guardarSesion(token: string, id_usuario: string, rol: string) {
  sessionStorage.setItem(TOKEN_KEY, token); 
  sessionStorage.setItem(USER_ID_KEY, id_usuario); 
  sessionStorage.setItem(ROL_KEY, rol); 
}

export function cerrarSesion() {
  sessionStorage.removeItem(TOKEN_KEY); 
  sessionStorage.removeItem(USER_ID_KEY); 
  sessionStorage.removeItem(ROL_KEY); 
}

export function obtenerToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY); 
}

export function obtenerUsuario(): { id_usuario: string; rol: string } | null {
  const id = sessionStorage.getItem(USER_ID_KEY); 
  const rol = sessionStorage.getItem(ROL_KEY); 

  if (id && rol) {
    return { id_usuario: id, rol };
  }
  return null;
}

export function estaAutenticado(): boolean {
  return !!sessionStorage.getItem(TOKEN_KEY); 
}