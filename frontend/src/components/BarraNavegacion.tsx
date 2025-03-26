import { NavLink, useNavigate } from 'react-router-dom';
import { cerrarSesion, obtenerUsuario } from '../state/auth';

function BarraNavegacion() {
  const usuario = obtenerUsuario();
  const navigate = useNavigate(); // Hook de react-router-dom para navegar entre rutas

  console.log('Clic en la barra de navegación'); // Depurar
  const handleLogout = () => {
    cerrarSesion();
    navigate('/'); // Redirigir al usuario a la página de inicio de sesión
  };

  if (!usuario) return null;

  return (
    <nav className="navbar navbar-expand-lg shadow-sm bg-white px-4 py-2 border-bottom">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        <span className="navbar-brand fw-bold fs-4 text-primary">Sistema de Asistencia</span>

        <div className="d-flex align-items-center">
          <ul className="navbar-nav d-flex flex-row gap-3 me-4">
            <li className="nav-item">
              <NavLink to="/inicio" className="nav-link">Inicio</NavLink>
            </li>
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
              <NavLink to="/horario" className="nav-link">Horario</NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/perfil" className="nav-link">Perfil</NavLink>
            </li>
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