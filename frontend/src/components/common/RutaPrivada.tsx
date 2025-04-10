// src/components/common/RutaPrivada.tsx
import { Navigate } from 'react-router-dom';
import { estaAutenticado, obtenerUsuario, cerrarSesion } from '../../state/auth';

interface Props {
  children: JSX.Element;
  roles: string[]; // Lista de roles permitidos para la ruta
}

function RutaPrivada({ children, roles }: Props) {
  const autenticado = estaAutenticado();
  const usuario = obtenerUsuario();

  console.log('RutaPrivada - Autenticado:', autenticado);
  console.log('RutaPrivada - Usuario:', usuario);

  if (!autenticado || !usuario) {
    console.log('RutaPrivada - Redirigiendo a /');
    return <Navigate to="/" replace />;
  }

  if (!roles.includes(usuario.rol)) {
    console.log(`RutaPrivada - Rol no autorizado (${usuario.rol}), redirigiendo...`);
    // Redirigir según el rol del usuario
    const redirectTo = usuario.rol === 'admin' ? '/admin' : '/inicio';
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default RutaPrivada;