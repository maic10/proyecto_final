import { Navigate } from 'react-router-dom';
import { estaAutenticado,  cerrarSesion } from '../state/auth';

interface Props {
  children: JSX.Element;
}

function RutaPrivada({ children }: Props) {
  const autenticado = estaAutenticado();
  console.log('RutaPrivada - Autenticado:', autenticado); // Para depurar

  if (!autenticado) {
    console.log('RutaPrivada - Redirigiendo a /');
    cerrarSesion(); // Asegurarnos de limpiar el estado
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RutaPrivada;