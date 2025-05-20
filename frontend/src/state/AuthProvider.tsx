import { createContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { estaAutenticado, obtenerUsuario, cerrarSesion } from './auth';
import { obtenerPerfil } from '../state/api';

interface AuthContextType {
  usuario: { id_usuario: string; rol: string } | null;
  cargando: boolean;
  verificarToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Componente proveedor de autenticación y contexto global
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<{ id_usuario: string; rol: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  /**
   * Verifica si el usuario está autenticado y su token es válido.
   * Si no está autenticado, cierra la sesión y redirige al inicio.
   */
  const verificarToken = async () => {
    setCargando(true);
    try {
      const autenticado = estaAutenticado();
      const user = obtenerUsuario();
      if (!autenticado || !user) {
        throw new Error('No autenticado');
      }

      await obtenerPerfil();
      setUsuario(user);
    } catch (err: any) {
      cerrarSesion();
      setUsuario(null);
      navigate('/');
    } finally {
      setCargando(false);
    }
  };
  
  // Ejecuta la verificación del token al montar el componente
  useEffect(() => {
    verificarToken();
  }, []);

  /**
   * Maneja los cambios en el almacenamiento (sessionStorage) para mantener el estado de autenticación sincronizado.
   * Si el usuario se desloguea en otra pestaña, actualiza el estado local y redirige.
   */
  const handleStorageChange = useCallback(() => {
    const autenticado = estaAutenticado();
    const user = obtenerUsuario();
    if (autenticado && user) {
      setUsuario(user);
    } else {
      setUsuario(null);
      navigate('/');
    }
  }, [navigate]);

  // Escucha los cambios en el almacenamiento y actualiza el estado de usuario
  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleStorageChange]);

  return (
    <AuthContext.Provider value={{ usuario, cargando, verificarToken }}>
      {children}
    </AuthContext.Provider>
  );
}