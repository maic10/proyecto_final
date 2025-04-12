// src/pages/profesor/PaginaHistorialAsistencias.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { obtenerClases, obtenerAsistenciasListado, exportarAsistencias } from '../../state/api';
import { Clase } from '../../types/clases';

interface AsistenciaResumen {
  _id: string;
  fecha: string;
  id_clase: string;
  nombre_clase: string;
  id_aula: string;
  nombre_aula: string;
}

const ITEMS_PER_PAGE = 10; // Número de registros por página

function PaginaHistorialAsistencias() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [asistencias, setAsistencias] = useState<AsistenciaResumen[]>([]);
  const [asistenciasOrdenadas, setAsistenciasOrdenadas] = useState<AsistenciaResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroClase, setFiltroClase] = useState<string>('');
  const [mostrarTodas, setMostrarTodas] = useState<boolean>(false);
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(false);

  // Exportación
  const [formatoExportacion, setFormatoExportacion] = useState<'csv' | 'xlsx'>('csv');
  const [mostrarDialogoExportar, setMostrarDialogoExportar] = useState<boolean>(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);

  const navigate = useNavigate();

  // Limpiar el mensaje de error después de 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Cargar las clases del profesor al montar el componente
  useEffect(() => {
    const cargarClases = async () => {
      setCargando(true);
      setError(null);
      try {
        const usuario = obtenerUsuario();
        if (!usuario || usuario.rol !== 'profesor') {
          setError('No tienes permisos para acceder a esta funcionalidad.');
          navigate('/inicio');
          return;
        }

        const clasesData = await obtenerClases(usuario.id_usuario);
        setClases(clasesData);
      } catch (err: any) {
        console.error('Error al cargar clases:', err);
        setError('Error al cargar las clases. Intenta de nuevo más tarde.');
      } finally {
        setCargando(false);
      }
    };
    cargarClases();
  }, [navigate]);

  // Cargar el listado de asistencias cuando cambian los filtros
  const cargarListado = async () => {
    // Requerir rango de fechas a menos que "mostrarTodas" esté activado
    if (!mostrarTodas && (!fechaInicio || !fechaFin)) {
      setError('Por favor selecciona un rango de fechas o activa "Mostrar todas las asistencias".');
      setAsistencias([]);
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const usuario = obtenerUsuario();
      if (!usuario) {
        setError('No estás autenticado. Por favor, inicia sesión.');
        navigate('/');
        return;
      }

      const asistenciasData = await obtenerAsistenciasListado(
        mostrarTodas ? undefined : fechaInicio,
        mostrarTodas ? undefined : fechaFin,
        filtroClase || undefined
      );

      setAsistencias(asistenciasData);
    } catch (err: any) {
      console.error('Error al cargar el listado de asistencias:', err);
      setError('Error al cargar el listado de asistencias. Intenta de nuevo más tarde.');
    } finally {
      setCargando(false);
    }
  };

  // Ordenar asistencias cuando cambian el listado o el orden
  useEffect(() => {
    const asistenciasOrdenadas = [...asistencias].sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      return ordenAscendente ? fechaA.getTime() - fechaB.getTime() : fechaB.getTime() - fechaA.getTime();
    });
    setAsistenciasOrdenadas(asistenciasOrdenadas);
  }, [asistencias, ordenAscendente]);

  // Manejar el cambio en los filtros
  const handleBuscar = () => {
    setPaginaActual(1); // Resetear la página al buscar
    cargarListado();
  };

  // Manejar la ordenación por fecha
  const handleOrdenar = () => {
    setOrdenAscendente(!ordenAscendente);
  };

  // Generar el nombre del archivo con formato "asistencia_ddmmyyyy_HHMM"
  const generarNombreArchivo = () => {
    const ahora = new Date();
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const anio = ahora.getFullYear();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    return `asistencia_${dia}${mes}${anio}_${horas}${minutos}.${formatoExportacion}`;
  };

  // Mostrar el diálogo de exportación
  const handleMostrarExportar = () => {
    setMostrarDialogoExportar(true);
  };

  // Confirmar la exportación
  const handleConfirmarExportar = async () => {
    setMostrarDialogoExportar(false);
    try {
      const blob = await exportarAsistencias(
        mostrarTodas ? undefined : fechaInicio,
        mostrarTodas ? undefined : fechaFin,
        filtroClase || undefined,
        formatoExportacion
      );

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', generarNombreArchivo());
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(`Error al exportar ${formatoExportacion.toUpperCase()}:`, err);
      setError(`No se pudo exportar el archivo ${formatoExportacion.toUpperCase()}`);
    }
  };

  // Cancelar la exportación
  const handleCancelarExportar = () => {
    setMostrarDialogoExportar(false);
  };

  // Paginación
  const totalPaginas = Math.ceil(asistenciasOrdenadas.length / ITEMS_PER_PAGE);
  const asistenciasPaginadas = asistenciasOrdenadas.slice(
    (paginaActual - 1) * ITEMS_PER_PAGE,
    paginaActual * ITEMS_PER_PAGE
  );

  return (
    <div className="container py-4">
      <h2 className="mb-4">Historial de Asistencias</h2>

      {/* Filtros */}
      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <label htmlFor="fechaInicio" className="form-label">Fecha Inicio</label>
            <input
              type="date"
              id="fechaInicio"
              className="form-control"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={mostrarTodas}
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="fechaFin" className="form-label">Fecha Fin</label>
            <input
              type="date"
              id="fechaFin"
              className="form-control"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={mostrarTodas}
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="filtroClase" className="form-label">Clase</label>
            <select
              id="filtroClase"
              className="form-select"
              value={filtroClase}
              onChange={(e) => setFiltroClase(e.target.value)}
            >
              <option value="">Todas las clases</option>
              {clases.map((clase) => (
                <option key={clase.id_clase} value={clase.id_clase}>
                  {clase.nombre_asignatura}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={handleBuscar}>
              Buscar
            </button>
          </div>
        </div>
        <div className="row g-2 mt-2">
          <div className="col-md-3">
            <div className="form-check">
              <input
                type="checkbox"
                id="mostrarTodas"
                className="form-check-input"
                checked={mostrarTodas}
                onChange={(e) => {
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

      {/* Botón de exportación y selector de formato */}
      <div className="mb-3 d-flex align-items-center">
        <button className="btn btn-success me-3" onClick={handleMostrarExportar}>
          Exportar
        </button>
        <select
          className="form-select w-auto"
          value={formatoExportacion}
          onChange={(e) => setFormatoExportacion(e.target.value as 'csv' | 'xlsx')}
        >
          <option value="csv">CSV</option>
          <option value="xlsx">Excel (xlsx)</option>
        </select>
      </div>

      {/* Diálogo de confirmación para exportar */}
      {mostrarDialogoExportar && (
        <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirmar Exportación</h5>
                <button type="button" className="btn-close" onClick={handleCancelarExportar}></button>
              </div>
              <div className="modal-body">
                <p>¿Estás seguro de que deseas exportar las asistencias en formato {formatoExportacion.toUpperCase()}?</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancelarExportar}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmarExportar}>
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
        <p>No hay asistencias en ese rango de fechas.</p>
      )}

      {!cargando && asistencias.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3 className="h5 mb-0">Lista de Asistencias</h3>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleOrdenar}
            >
              Ordenar por fecha {ordenAscendente ? '↓' : '↑'}
            </button>
          </div>
          <table className="table table-bordered mb-4">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Clase</th>
                <th>Aula</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asistenciasPaginadas.map((asistencia, idx) => (
                <tr key={idx}>
                  <td>{asistencia.fecha}</td>
                  <td>{asistencia.nombre_clase}</td>
                  <td>{asistencia.nombre_aula}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/asistencias/detalle?fecha=${asistencia.fecha}&id_clase=${asistencia.id_clase}`)}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <nav className="mt-4">
              <ul className="pagination justify-content-center">
                <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={() => setPaginaActual(paginaActual - 1)}
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </button>
                </li>
                {[...Array(totalPaginas)].map((_, index) => (
                  <li key={index} className={`page-item ${paginaActual === index + 1 ? 'active' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPaginaActual(index + 1)}
                    >
                      {index + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
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