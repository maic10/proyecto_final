// src/components/common/BarraNavegacion.tsx
import { NavLink, useNavigate } from 'react-router-dom';
import { obtenerUsuario, cerrarSesion } from '../../state/auth';

function BarraNavegacion() {
  const usuario = obtenerUsuario();
  const navigate = useNavigate();

  if (!usuario) return null;

  const isAdmin = usuario.rol === 'admin';

  const handleLogout = () => {
    cerrarSesion();
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand-lg shadow-sm bg-white px-4 py-2 border-bottom">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <span className="navbar-brand fw-bold fs-4 text-primary">Sistema de Asistencia</span>

        <div className="d-flex align-items-center">
          <ul className="navbar-nav d-flex flex-row gap-3 me-4">
            <li className="nav-item">
              <NavLink to={isAdmin ? "/admin" : "/inicio"} className="nav-link">Inicio</NavLink>
            </li>
            {isAdmin ? (
              <>
                <li className="nav-item">
                  <NavLink to="/admin/estudiantes" className="nav-link">Estudiantes</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/admin/horarios" className="nav-link">Horarios</NavLink>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <NavLink to="/transmision" className="nav-link">Transmisión</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/estudiantes" className="nav-link">Estudiantes</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/asistencias" className="nav-link">Asistencias</NavLink>
                </li>
                <li className="nav-item">
                  <NavLink to="/perfil" className="nav-link">Perfil</NavLink>
                </li>
              </>
            )}
          </ul>

          <div className="d-flex align-items-center gap-3">
            <span className="text-secondary small">Rol: <strong>{usuario.rol}</strong></span>
            <button className="btn btn-danger btn-sm" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default BarraNavegacion;