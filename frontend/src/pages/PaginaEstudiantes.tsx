// src/pages/PaginaEstudiantes.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerClases, obtenerEstudiantesPorClase, obtenerAsistenciasEstudiante } from '../state/api';
import { obtenerUsuario } from '../state/auth';
import EstudianteCard from '../components/EstudianteCard';
import * as bootstrap from 'bootstrap'; // Importar Bootstrap para controlar el modal

interface Estudiante {
  id_estudiante: string;
  nombre: string;
  apellido: string;
  urls_fotos: string[];
}

interface Asistencia {
  fecha: string;
  estado: string;
}

interface ResumenAsistencias {
  asistidas: number;
  ausentes: number;
}

function PaginaEstudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState<Estudiante[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'asc' | 'desc'>('asc');
  const [cargando, setCargando] = useState(true);
  const [idClase, setIdClase] = useState<string | null>(null);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [resumenAsistencias, setResumenAsistencias] = useState<ResumenAsistencias | null>(null);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false);
  const [errorAsistencias, setErrorAsistencias] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const modalRef = useRef<bootstrap.Modal | null>(null); // Referencia al modal

  // Inicializar el modal
  useEffect(() => {
    const modalElement = document.getElementById('asistenciasModal');
    if (modalElement) {
      modalRef.current = new bootstrap.Modal(modalElement);
    }
  }, []);

  const cargarEstudiantes = async () => {
    const usuario = obtenerUsuario();
    if (!usuario) {
      setCargando(false);
      navigate('/');
      return;
    }

    try {
      const clases = await obtenerClases(usuario.id_usuario);
      if (clases.length > 0) {
        const clase = clases[0];
        setIdClase(clase.id_clase);
        const estudiantesData = await obtenerEstudiantesPorClase(clase.id_clase);
        setEstudiantes(estudiantesData);
        setEstudiantesFiltrados(estudiantesData);
      } else {
        setEstudiantes([]);
        setEstudiantesFiltrados([]);
      }
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      setEstudiantes([]);
      setEstudiantesFiltrados([]);
    } finally {
      setCargando(false);
    }
  };

  // Filtrar y ordenar estudiantes
  useEffect(() => {
    let filtrados = estudiantes.filter((est) =>
      `${est.nombre} ${est.apellido}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    );

    filtrados.sort((a, b) => {
      const nombreA = `${a.nombre} ${a.apellido}`.toLowerCase();
      const nombreB = `${b.nombre} ${b.apellido}`.toLowerCase();
      if (orden === 'asc') {
        return nombreA.localeCompare(nombreB);
      } else {
        return nombreB.localeCompare(nombreA);
      }
    });

    setEstudiantesFiltrados(filtrados);
  }, [busqueda, estudiantes, orden]);

  useEffect(() => {
    if (location.pathname === '/estudiantes') {
      cargarEstudiantes();
    }
  }, [location.pathname]);

  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusqueda(e.target.value);
  };

  const handleOrdenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOrden(e.target.value as 'asc' | 'desc');
  };

  const handleEstudianteClick = async (estudiante: Estudiante) => {
    setEstudianteSeleccionado(estudiante);
    setCargandoAsistencias(true);
    setErrorAsistencias(null);

    try {
      if (!idClase) return;

      // Calcular fechas para los últimos 30 días
      const hoy = new Date();
      const fechaFin = hoy.toISOString().split('T')[0];
      const fechaInicio = new Date(hoy.setDate(hoy.getDate() - 30)).toISOString().split('T')[0];

      // Obtener todas las asistencias del estudiante
      const datos = await obtenerAsistenciasEstudiante(idClase, estudiante.id_estudiante, fechaInicio, fechaFin);
      
      console.log('Datos recibidos de /asistencias/estudiante:', datos);

      setResumenAsistencias({
        asistidas: datos.resumen.asistidas || 0,
        ausentes: datos.resumen.ausentes || 0,
      });
      setAsistencias(datos.asistencias.slice(0, 5)); // Tomar las últimas 5 asistencias

      // Abrir el modal después de actualizar los datos
      if (modalRef.current) {
        modalRef.current.show();
      }
    } catch (error: any) {
      console.error('Error al cargar asistencias:', error);
      if (error.response?.status === 401) {
        setErrorAsistencias('Sesión expirada. Por favor, inicia sesión nuevamente.');
        setTimeout(() => navigate('/'), 3000);
      } else {
        setErrorAsistencias('Error al cargar las asistencias. Intenta de nuevo más tarde.');
      }
      setAsistencias([]);
      setResumenAsistencias(null);

      // Abrir el modal incluso si hay error para mostrar el mensaje
      if (modalRef.current) {
        modalRef.current.show();
      }
    } finally {
      setCargandoAsistencias(false);
    }
  };

  return (
    <div className="container py-5">
      {/* Encabezado */}
      <div className="row mb-5 align-items-center">
        <div className="col-md-6">
          <h1 className="display-5 fw-bold text-primary mb-2">
            <i className="bi bi-people me-2"></i>Estudiantes de tu Clase
          </h1>
          <p className="lead text-muted">
            Tienes {estudiantes.length} {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} asignados
          </p>
        </div>
        <div className="col-md-6 d-flex justify-content-end align-items-center gap-3">
          <div className="input-group" style={{ maxWidth: '300px' }}>
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Buscar estudiante..."
              value={busqueda}
              onChange={handleBusquedaChange}
              style={{ borderRadius: '0 5px 5px 0' }}
            />
          </div>
          <select
            className="form-select"
            style={{ maxWidth: '150px' }}
            value={orden}
            onChange={handleOrdenChange}
          >
            <option value="asc">Nombre (A-Z)</option>
            <option value="desc">Nombre (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Contenido */}
      {cargando ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando estudiantes...</p>
        </div>
      ) : estudiantes.length === 0 ? (
        <div className="alert alert-info text-center" role="alert">
          No hay estudiantes asignados a tu clase.
        </div>
      ) : (
        <div className="row g-4">
          {estudiantesFiltrados.length === 0 ? (
            <div className="col-12">
              <div className="alert alert-warning text-center" role="alert">
                No se encontraron estudiantes que coincidan con tu búsqueda.
              </div>
            </div>
          ) : (
            estudiantesFiltrados.map((est) => (
              <div key={est.id_estudiante} className="col-6 col-md-4 col-lg-3">
                <div onClick={() => handleEstudianteClick(est)}>
                  <EstudianteCard
                    nombre={est.nombre}
                    apellido={est.apellido}
                    fotoUrl={est.urls_fotos?.[0]}
                    idEstudiante={est.id_estudiante}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Asistencias */}
      <div
        className="modal fade"
        id="asistenciasModal"
        tabIndex={-1}
        aria-labelledby="asistenciasModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="asistenciasModalLabel">
                Asistencias de {estudianteSeleccionado?.nombre} {estudianteSeleccionado?.apellido}
              </h5>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {cargandoAsistencias ? (
                <div className="text-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="mt-2">Cargando asistencias...</p>
                </div>
              ) : errorAsistencias ? (
                <div className="alert alert-danger text-center" role="alert">
                  {errorAsistencias}
                </div>
              ) : (
                <>
                  {/* Resumen de Asistencias */}
                  {resumenAsistencias ? (
                    <div className="mb-4">
                      <h6 className="text-muted mb-3">
                        <i className="bi bi-bar-chart me-2"></i>Resumen (Últimos 30 días)
                      </h6>
                      <div className="d-flex justify-content-around">
                        <div className="text-center">
                          <p className="mb-1 text-success fw-bold">{resumenAsistencias.asistidas}</p>
                          <small className="text-muted">Asistidas</small>
                        </div>
                        <div className="text-center">
                          <p className="mb-1 text-danger fw-bold">{resumenAsistencias.ausentes}</p>
                          <small className="text-muted">Ausentes</small>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted">No hay datos de asistencias disponibles.</p>
                  )}

                  {/* Últimas 5 Asistencias */}
                  <h6 className="text-muted mb-3">
                    <i className="bi bi-list-check me-2"></i>Últimas 5 Asistencias
                  </h6>
                  {asistencias.length > 0 ? (
                    <ul className="list-group">
                      {asistencias.map((asistencia, idx) => (
                        <li
                          key={idx}
                          className="list-group-item d-flex justify-content-between align-items-center"
                        >
                          <span>{asistencia.fecha}</span>
                          <span
                            className={`badge ${
                              asistencia.estado === 'confirmado'
                                ? 'bg-success'
                                : 'bg-danger'
                            }`}
                          >
                            {asistencia.estado === 'confirmado' ? 'Presente' : 'Ausente'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No hay asistencias recientes.</p>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaginaEstudiantes;