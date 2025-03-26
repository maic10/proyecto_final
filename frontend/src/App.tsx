import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import PaginaInicioSesion from './pages/PaginaInicioSesion';
import PaginaPrincipal from './pages/PaginaPrincipal';
import BarraNavegacion from './components/BarraNavegacion';
import PaginaEstudiantes from './pages/PaginaEstudiantes';
import PaginaAsistencias from './pages/PaginaAsistencias';
import PaginaAsistenciaDetalle from './pages/PaginaAsistenciaDetalle';
import RutaPrivada from './components/RutaPrivada';
import { estaAutenticado } from './state/auth';

function AppWrapper() {
  const location = useLocation(); // Contiene información de la ruta actural
  // Mostrar la barra de navegación si no estamos en la página de inicio y el usuario está autenticado
  const mostrarBarra = location.pathname !== '/' && estaAutenticado();

  return (
    <>
      {mostrarBarra && <BarraNavegacion />}  {/* Mostrar la barra de navegación si mostrarBarra es verdadero */ }
      <Routes>
        <Route path="/" element={<PaginaInicioSesion />} />
        <Route path="/inicio" element={<RutaPrivada><PaginaPrincipal /></RutaPrivada>} />
        <Route path="/estudiantes" element={<RutaPrivada><PaginaEstudiantes /></RutaPrivada>} />
        <Route path="/asistencias" element={<RutaPrivada><PaginaAsistencias /></RutaPrivada>} />
        <Route path="/asistencias/detalle" element={<RutaPrivada><PaginaAsistenciaDetalle /></RutaPrivada>} />
        {/* Agregar una ruta para manejar 404 */}
        <Route path="*" element={<div><h2>404 - Página no encontrada</h2><p>La ruta {location.pathname} no existe.</p></div>} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;