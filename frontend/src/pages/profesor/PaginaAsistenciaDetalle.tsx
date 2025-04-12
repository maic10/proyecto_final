// src/pages/profesor/PaginaAsistenciaDetalle.tsx
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { obtenerAsistenciaDetalle } from '../../state/api';
import { AsistenciaDetalle } from '../../types/asistencias';

function PaginaAsistenciaDetalle() {
  const [detalle, setDetalle] = useState<AsistenciaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    cargarDetalle();
  }, []);

  const cargarDetalle = async () => {
    setCargando(true);
    setError('');

    const usuario = obtenerUsuario();
    if (!usuario) {
      navigate('/');
      return;
    }

    const fechaParam = searchParams.get('fecha');
    const idClaseParam = searchParams.get('id_clase');

    if (!fechaParam || !idClaseParam) {
      setError('Faltan parámetros en la URL (fecha, id_clase).');
      setCargando(false);
      return;
    }

    try {
      const data = await obtenerAsistenciaDetalle(idClaseParam, fechaParam);
      setDetalle(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar el detalle de la asistencia');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Detalle de Asistencia</h2>

      <button
        className="btn btn-secondary mb-3"
        onClick={() => navigate('/asistencias')}
      >
        Volver al Historial
      </button>

      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && <p>Cargando...</p>}

      {!cargando && detalle && (
        <>
          <p><strong>Clase:</strong> {detalle.nombre_clase} ({detalle.id_clase})</p>
          <p><strong>Aula:</strong> {detalle.nombre_aula} ({detalle.id_aula})</p>
          <p><strong>Fecha:</strong> {detalle.fecha}</p>

          <h5>Registros:</h5>
          {detalle.registros.length === 0 ? (
            <p>No hay estudiantes registrados.</p>
          ) : (
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Estado</th>
                  <th>Fecha detección</th>
                  <th>Modificado por</th>
                  <th>Fecha modificación</th>
                </tr>
              </thead>
              <tbody>
                {detalle.registros.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.Estudiante}</td>
                    <td>{r.Estado}</td>
                    <td>{r["Fecha detección"] || ""}</td>
                    <td>{r["Modificado por"] || ""}</td>
                    <td>{r["Fecha modificación"] || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default PaginaAsistenciaDetalle;