// src/components/common/RutaPrivada.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../state/useAuth'; // Actualizar importación
import { cerrarSesion } from '../../state/auth';

interface Props {
  children: JSX.Element;
  roles: string[];
}

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