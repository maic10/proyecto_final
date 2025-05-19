// src/pages/profesor/PaginaAsistenciaDetalle.tsx
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { obtenerAsistenciaDetalle } from '../../state/api';
import { AsistenciaDetalle, Registro } from '../../types/asistencias';

function PaginaAsistenciaDetalle() {
  const [detalle, setDetalle] = useState<AsistenciaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // filtros de UI
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos'|'confirmado'|'tarde'|'ausente'>('todos');

  useEffect(() => { cargarDetalle(); }, []);

  const cargarDetalle = async () => {
    setCargando(true); setError('');
    const usuario = obtenerUsuario();
    if (!usuario) { navigate('/'); return; }

    const fecha = searchParams.get('fecha');
    const id_clase = searchParams.get('id_clase');
    if (!fecha || !id_clase) {
      setError('Parámetros “fecha” o “id_clase” faltantes.');
      setCargando(false);
      return;
    }

    try {
      const data = await obtenerAsistenciaDetalle(id_clase, fecha);
      setDetalle(data);
    } catch {
      setError('No se pudo cargar los datos de asistencia.');
    } finally {
      setCargando(false);
    }
  };

  const formateaFecha = (iso?: string) =>
    iso ? new Date(iso).toLocaleString() : '';

  const badgeClass = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'confirmado': return 'bg-success';
      case 'tarde':      return 'bg-warning';
      case 'ausente':    return 'bg-danger';
      default:           return 'bg-secondary';
    }
  };

  // Estadísticas y filtrado memoriza­dos
  const { confirmados, tardes, ausentes, filtrados } = useMemo(() => {
    const regs = detalle?.registros || [];
    let c=0, t=0, a=0;
    regs.forEach(r => {
      switch (r.Estado.toLowerCase()) {
        case 'confirmado': c++; break;
        case 'tarde':      t++; break;
        case 'ausente':    a++; break;
      }
    });
    // filtrar por búsqueda y estado
    const filtrados = regs.filter(r => {
      const okEstado = filtroEstado === 'todos' || r.Estado.toLowerCase() === filtroEstado;
      const okBusqueda = r.Estudiante.toLowerCase().includes(busqueda.toLowerCase());
      return okEstado && okBusqueda;
    });
    return { confirmados: c, tardes: t, ausentes: a, filtrados };
  }, [detalle, busqueda, filtroEstado]);

  return (
    <div className="container py-4">
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h2 className="mb-0 display-6 fw-bold text-primary">Detalle de Asistencia</h2>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/asistencias')}>
            ← Volver
          </button>
        </div>

        <div className="card-body">
          {error && <div className="alert alert-danger">{error}</div>}

          {cargando ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : detalle ? (
            <>
              {/* Datos generales */}
              <div className="row mb-4 gx-3">
                <div className="col-md-4">
                  <div className="p-3 border rounded bg-light text-center h-100">
                    <h6 className="text-uppercase text-muted mb-1">Clase</h6>
                    <p className="mb-0 fw-semibold">{detalle.nombre_clase}</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded bg-light text-center h-100">
                    <h6 className="text-uppercase text-muted mb-1">Aula</h6>
                    <p className="mb-0 fw-semibold">{detalle.nombre_aula}</p>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded bg-light text-center h-100">
                    <h6 className="text-uppercase text-muted mb-1">Fecha</h6>
                    <p className="mb-0 fw-semibold">{detalle.fecha}</p>
                  </div>
                </div>
              </div>

              {/* Resumen compacto de estados */}
              <div className="d-flex justify-content-start align-items-center gap-3 mb-4 flex-wrap">
                <div className="text-center">
                  <span className="badge bg-success fs-6 px-3 py-2">
                    Confirmados <strong>{confirmados}</strong>
                  </span>
                </div>
                <div className="text-center">
                  <span className="badge bg-warning fs-6 px-3 py-2">
                    Tarde <strong>{tardes}</strong>
                  </span>
                </div>
                <div className="text-center">
                  <span className="badge bg-danger fs-6 px-3 py-2">
                    Ausentes <strong>{ausentes}</strong>
                  </span>
                </div>
              </div>

              {/* Filtros */}
              <div className="row mb-3 g-2">
                <div className="col-md-6">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar estudiante..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={filtroEstado}
                    onChange={e => setFiltroEstado(e.target.value as any)}
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="tarde">Tarde</option>
                    <option value="ausente">Ausente</option>
                  </select>
                </div>
              </div>

              {/* Tabla */}
              {filtrados.length === 0 ? (
                <p className="text-muted">No hay registros que coincidan.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Estudiante</th>
                        <th>Estado</th>
                        <th>Fecha detección</th>
                        <th>Modificado por</th>
                        <th>Fecha modificación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map((r: Registro, i) => (
                        <tr key={i}>
                          <td>{r.Estudiante}</td>
                          <td>
                            <span className={`badge ${badgeClass(r.Estado)}`}>
                              {r.Estado}
                            </span>
                          </td>
                          <td>{formateaFecha(r['Fecha detección'])}</td>
                          <td>{r['Modificado por'] || '-'}</td>
                          <td>{formateaFecha(r['Fecha modificación'])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default PaginaAsistenciaDetalle;
