// src/pages/profesor/PaginaHistorialAsistencias.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import {
  obtenerClases,
  obtenerAsistenciasListado,
  exportarAsistencias
} from '../../state/api';
import { Clase } from '../../types/clases';
import { AsistenciaResumen } from '../../types/asistencias';

const ITEMS_PER_PAGE = 10;

function PaginaHistorialAsistencias() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaResumen[]>([]);
  const [asistenciasOrdenadas, setAsistenciasOrdenadas] = useState<AsistenciaResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroClase, setFiltroClase] = useState<string>('');
  const [mostrarTodas, setMostrarTodas] = useState<boolean>(false);
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(false);

  const [formatoExportacion, setFormatoExportacion] = useState<'csv' | 'xlsx'>('csv');
  const [mostrarDialogoExportar, setMostrarDialogoExportar] = useState<boolean>(false);

  const [paginaActual, setPaginaActual] = useState<number>(1);

  const navigate = useNavigate();

  // Maneja el clic en "Buscar"
  const handleBuscar = () => {
    setPaginaActual(1);
    cargarListado();
  };

  // Alterna orden
  const handleOrdenar = () => setOrdenAscendente(!ordenAscendente);

  // Lanza el diálogo de exportar
  const handleMostrarExportar = () => setMostrarDialogoExportar(true);
  const handleCancelarExportar = () => setMostrarDialogoExportar(false);

  // Confirma y descarga
  const generarNombreArchivo = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `asistencia_${pad(now.getDate())}${pad(now.getMonth()+1)}${now.getFullYear()}_${pad(now.getHours())}${pad(now.getMinutes())}.${formatoExportacion}`;
  };
  const handleConfirmarExportar = async () => {
    setMostrarDialogoExportar(false);
    try {
      const blob = await exportarAsistencias(
        mostrarTodas ? undefined : fechaInicio,
        mostrarTodas ? undefined : fechaFin,
        filtroClase || undefined,
        formatoExportacion
      );
      const url = URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = generarNombreArchivo();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError(`No se pudo exportar en ${formatoExportacion.toUpperCase()}`);
    }
  };

  // Carga el listado de asistencias
  const cargarListado = async () => {
    if (!mostrarTodas && (!fechaInicio || !fechaFin)) {
      setError('Selecciona un rango de fechas o activa "Mostrar todas".');
      setAsistencias([]);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const usuario = obtenerUsuario();
      if (!usuario) {
        setError('No autenticado.');
        navigate('/');
        return;
      }
      const data = await obtenerAsistenciasListado(
        mostrarTodas ? undefined : fechaInicio,
        mostrarTodas ? undefined : fechaFin,
        filtroClase || undefined
      );
      setAsistencias(data);
    } catch {
      setError('Error al cargar el listado.');
    } finally {
      setCargando(false);
    }
  };

  // Carga clases al montar
  useEffect(() => {
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const usuario = obtenerUsuario();
        if (!usuario || usuario.rol !== 'profesor') {
          setError('Sin permisos.');
          navigate('/inicio');
          return;
        }
        const cls = await obtenerClases(usuario.id_usuario);
        setClases(cls);
      } catch {
        setError('Error al cargar las clases.');
      } finally {
        setCargando(false);
      }
    })();
  }, [navigate]);

  // Reordena cada vez que cambian asistencias u orden
  useEffect(() => {
    const ordenadas = [...asistencias].sort((a, b) => {
      const tA = new Date(a.fecha).getTime();
      const tB = new Date(b.fecha).getTime();
      return ordenAscendente ? tA - tB : tB - tA;
    });
    setAsistenciasOrdenadas(ordenadas);
  }, [asistencias, ordenAscendente]);

  // Paginación
  const totalPaginas = Math.ceil(asistenciasOrdenadas.length / ITEMS_PER_PAGE);
  const asistenciasPaginadas = asistenciasOrdenadas.slice(
    (paginaActual - 1) * ITEMS_PER_PAGE,
    paginaActual * ITEMS_PER_PAGE
  );

  return (
    <div className="container py-4">
      <h2 className="display-6 fw-bold text-primary mb-3">Historial de Asistencias</h2>

      {/* Filtros */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Fecha Inicio</label>
              <input
                type="date"
                className="form-control"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                disabled={mostrarTodas}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Fecha Fin</label>
              <input
                type="date"
                className="form-control"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                disabled={mostrarTodas}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Clase</label>
              <select
                className="form-select"
                value={filtroClase}
                onChange={e => setFiltroClase(e.target.value)}
              >
                <option value="">Todas</option>
                {clases.map(c => (
                  <option key={c.id_clase} value={c.id_clase}>
                    {c.nombre_asignatura}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="btn btn-primary w-100"
                onClick={handleBuscar}
              >
                Buscar
              </button>
            </div>
            <div className="col-12">
              <div className="form-check">
                <input
                  id="mostrarTodas"
                  type="checkbox"
                  className="form-check-input"
                  checked={mostrarTodas}
                  onChange={e => {
                    setMostrarTodas(e.target.checked);
                    if (e.target.checked) {
                      setFechaInicio('');
                      setFechaFin('');
                    }
                  }}
                />
                <label htmlFor="mostrarTodas" className="form-check-label">
                  Mostrar todas las asistencias
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exportar */}
      <div className="d-flex mb-3">
        <button className="btn btn-success me-2" onClick={handleMostrarExportar}>
          Exportar
        </button>
        <select
          className="form-select w-auto"
          value={formatoExportacion}
          onChange={e => setFormatoExportacion(e.target.value as any)}
        >
          <option value="csv">CSV</option>
          <option value="xlsx">Excel</option>
        </select>
      </div>

      {/* Diálogo exportar */}
      {mostrarDialogoExportar && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar Exportación</h5>
                <button className="btn-close" onClick={handleCancelarExportar}></button>
              </div>
              <div className="modal-body">
                <p>¿Exportar en <strong>{formatoExportacion.toUpperCase()}</strong>?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={handleCancelarExportar}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleConfirmarExportar}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && <p>Cargando...</p>}

      {!cargando && asistencias.length === 0 && (
        <p className="text-muted">No hay asistencias en este rango.</p>
      )}

      {!cargando && asistencias.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">Lista de Asistencias</h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleOrdenar}
            >
              Orden {ordenAscendente ? '↓' : '↑'}
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Clase</th>
                  <th>Aula</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {asistenciasPaginadas.map((a, i) => (
                  <tr key={i}>
                    <td>{a.fecha}</td>
                    <td>{a.nombre_clase}</td>
                    <td>{a.nombre_aula}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          navigate(
                            `/asistencias/detalle?fecha=${a.fecha}&id_clase=${a.id_clase}`
                          )
                        }
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <nav>
              <ul className="pagination justify-content-center">
                <li className={`page-item ${paginaActual === 1 && 'disabled'}`}>
                  <button
                    className="page-link"
                    onClick={() => setPaginaActual(paginaActual - 1)}
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </button>
                </li>
                {Array.from({ length: totalPaginas }).map((_, idx) => (
                  <li
                    key={idx}
                    className={`page-item ${paginaActual === idx + 1 && 'active'}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setPaginaActual(idx + 1)}
                    >
                      {idx + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${paginaActual === totalPaginas && 'disabled'}`}>
                  <button
                    className="page-link"
                    onClick={() => setPaginaActual(paginaActual + 1)}
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default PaginaHistorialAsistencias;
