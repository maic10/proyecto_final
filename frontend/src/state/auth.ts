const TOKEN_KEY = 'token';
const USER_ID_KEY = 'id_usuario';
const ROL_KEY = 'rol';

export function guardarSesion(token: string, id_usuario: string, rol: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, id_usuario);
  localStorage.setItem(ROL_KEY, rol);
}

export function cerrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(ROL_KEY);
}

export function obtenerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function obtenerUsuario(): { id_usuario: string; rol: string } | null {
  const id = localStorage.getItem(USER_ID_KEY);
  const rol = localStorage.getItem(ROL_KEY);

  if (id && rol) {
    return { id_usuario: id, rol };
  }
  return null;
}

export function estaAutenticado(): boolean {
  return !!localStorage.getItem(TOKEN_KEY);
}
