import { Navigate } from 'react-router-dom';
import { useAuth } from '../../state/useAuth'; 
import { cerrarSesion } from '../../state/auth';

interface Props {
  children: JSX.Element;
  roles: string[];
}

/**
 * RutaPrivada: componente para proteger rutas según autenticación y rol.
 * Si el usuario no está autenticado o no tiene el rol adecuado, redirige al inicio.
 */
function RutaPrivada({ children, roles }: Props) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <p>Cargando...</p>;
  }

  if (!usuario) {
    console.log('RutaPrivada - Redirigiendo a /');
    return <Navigate to="/" replace />;
  }

  if (!roles.includes(usuario.rol)) {
    console.log(`RutaPrivada - Rol no autorizado (${usuario.rol}), cerrando sesión y redirigiendo a /...`);
    cerrarSesion();
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RutaPrivada;