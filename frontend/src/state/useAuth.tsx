import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

/**
 * Hook personalizado para acceder al contexto de autenticación.
 * Debe ser usado dentro de un AuthProvider.
 * @returns El contexto de autenticación (usuario, cargando, verificarToken).
 * @throws Error si se usa fuera de un AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}