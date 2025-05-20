const TOKEN_KEY = 'token';
const USER_ID_KEY = 'id_usuario';
const ROL_KEY = 'rol';

/**
 * Guarda la sesión del usuario en sessionStorage.
 * @param token Token JWT de autenticación.
 * @param id_usuario ID del usuario autenticado.
 * @param rol Rol del usuario.
 */
export function guardarSesion(token: string, id_usuario: string, rol: string) {
  sessionStorage.setItem(TOKEN_KEY, token); 
  sessionStorage.setItem(USER_ID_KEY, id_usuario); 
  sessionStorage.setItem(ROL_KEY, rol); 
}

/**
 * Elimina los datos de sesión del usuario de sessionStorage.
 */
export function cerrarSesion() {
  sessionStorage.removeItem(TOKEN_KEY); 
  sessionStorage.removeItem(USER_ID_KEY); 
  sessionStorage.removeItem(ROL_KEY); 
}

/**
 * Obtiene el token JWT almacenado en sessionStorage.
 * @returns El token JWT o null si no existe.
 */
export function obtenerToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY); 
}

/**
 * Obtiene el usuario autenticado y su rol desde sessionStorage.
 * @returns Un objeto con id_usuario y rol, o null si no hay sesión.
 */
export function obtenerUsuario(): { id_usuario: string; rol: string } | null {
  const id = sessionStorage.getItem(USER_ID_KEY); 
  const rol = sessionStorage.getItem(ROL_KEY); 

  if (id && rol) {
    return { id_usuario: id, rol };
  }
  return null;
}

/**
 * Verifica si el usuario está autenticado.
 * @returns true si hay un token almacenado, false en caso contrario.
 */
export function estaAutenticado(): boolean {
  return !!sessionStorage.getItem(TOKEN_KEY); 
}