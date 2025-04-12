// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import BarraNavegacion from './components/common/BarraNavegacion';
import RutaPrivada from './components/common/RutaPrivada';
import PaginaInicioSesion from './pages/common/PaginaInicioSesion';
import PaginaPrincipal from './pages/profesor/PaginaPrincipal';
import PaginaEstudiantes from './pages/profesor/PaginaEstudiantes';
import PaginaAsistencias from './pages/profesor/PaginaHistorialAsistencias';
import PaginaAsistenciaDetalle from './pages/profesor/PaginaAsistenciaDetalle';
import PaginaTransmision from './pages/profesor/PaginaTransmision';
import PaginaPrincipalAdmin from './pages/admin/PaginaPrincipalAdmin';
import PaginaGestionarEstudiantes from './pages/admin/PaginaGestionarEstudiantes';
import PaginaCrearEstudiante from './pages/admin/PaginaCrearEstudiante';
import PaginaEditarEstudiante from './pages/admin/PaginaEditarEstudiante';
import GestionarHorarios from './pages/admin/GestionarHorarios';
import PaginaEditarHorarios from './pages/admin/PaginaEditarHorarios';
import { estaAutenticado } from './state/auth';

function AppWrapper() {
  const location = useLocation();
  const mostrarBarra = location.pathname !== '/' && estaAutenticado();

  return (
    <>
      {mostrarBarra && <BarraNavegacion />}
      <Routes>
        <Route path="/" element={<PaginaInicioSesion />} />
        {/* Rutas para profesores */}
        <Route
          path="/inicio"
          element={
            <RutaPrivada roles={['profesor']}>
              <PaginaPrincipal />
            </RutaPrivada>
          }
        />
        <Route
          path="/estudiantes"
          element={
            <RutaPrivada roles={['profesor']}>
              <PaginaEstudiantes />
            </RutaPrivada>
          }
        />
        <Route
          path="/asistencias"
          element={
            <RutaPrivada roles={['profesor']}>
              <PaginaAsistencias />
            </RutaPrivada>
          }
        />
        <Route
          path="/asistencias/detalle"
          element={
            <RutaPrivada roles={['profesor']}>
              <PaginaAsistenciaDetalle />
            </RutaPrivada>
          }
        />
        <Route
          path="/transmision"
          element={
            <RutaPrivada roles={['profesor']}>
              <PaginaTransmision />
            </RutaPrivada>
          }
        />
        {/* Rutas para administradores */}
        <Route
          path="/admin"
          element={
            <RutaPrivada roles={['admin']}>
              <PaginaPrincipalAdmin />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin/estudiantes"
          element={
            <RutaPrivada roles={['admin']}>
              <PaginaGestionarEstudiantes />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin/estudiantes/crear"
          element={
            <RutaPrivada roles={['admin']}>
              <PaginaCrearEstudiante />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin/estudiantes/editar/:id"
          element={
            <RutaPrivada roles={['admin']}>
              <PaginaEditarEstudiante />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin/horarios"
          element={
            <RutaPrivada roles={['admin']}>
              <GestionarHorarios />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin/horarios/editar/:id"
          element={
            <RutaPrivada roles={['admin']}>
              <PaginaEditarHorarios />
            </RutaPrivada>
          }
        />        
        <Route path="*" element={<div className="container py-5"><h2>404 - Página no encontrada</h2><p>La ruta {location.pathname} no existe.</p></div>} />
      </Routes>
    </>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', 'light');
  }, []);
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;