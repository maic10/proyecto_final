// src/pages/admin/PaginaPrincipalAdmin.tsx
import { Link } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';

function PaginaPrincipalAdmin() {
  const user = obtenerUsuario();

  if (!user || user.rol !== 'admin') {
    return null;
  }

  return (
    <div className="container py-5">
      <div className="row mb-4 align-items-center">
        <div className="col-12 text-center">
          <h1 className="display-4 fw-bold text-primary mb-2">
            ¡Hola, Administrador!
          </h1>
          <p className="lead text-muted">
            Aquí puedes gestionar estudiantes.
          </p>
        </div>
      </div>

      <div className="row mb-5 justify-content-center">
        <div className="col-md-4">
          <div className="card shadow-sm text-center">
            <div className="card-body">
              <h5 className="card-title">Gestionar Estudiantes</h5>
              <p className="card-text">Añade, edita o elimina estudiantes y sus fotos.</p>
              <Link to="/admin/estudiantes" className="btn btn-primary">
                Ir a Estudiantes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaginaPrincipalAdmin;