// src/pages/profesor/PaginaEstudiantes.tsx
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerClases, obtenerEstudiantes, obtenerAsistenciasEstudiante } from '../../state/api';
import { obtenerUsuario } from '../../state/auth';
import ClasesList from '../../components/clases/ClasesList';
import EstudiantesList from '../../components/estudiantes/EstudiantesList';
import * as bootstrap from 'bootstrap';
import { Clase } from '../../types/clases';
import { Estudiante } from '../../types/estudiantes';
import { Asistencia, ResumenAsistencias } from '../../types/asistencias';

/**
 * Página para que el profesor consulte sus clases y los estudiantes de cada clase.
 * Permite ver detalles y asistencias recientes de cada estudiante.
 */
function PaginaEstudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState<Estudiante[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [claseSeleccionada, setClaseSeleccionada] = useState<Clase | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'asc' | 'desc'>('asc');
  const [cargando, setCargando] = useState(true);
  const [cargandoEstudiantes, setCargandoEstudiantes] = useState(false);
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState<Estudiante | null>(null);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [resumenAsistencias, setResumenAsistencias] = useState<ResumenAsistencias | null>(null);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false);
  const [errorAsistencias, setErrorAsistencias] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const modalRef = useRef<bootstrap.Modal | null>(null);
  const focusAnchorRef = useRef<HTMLButtonElement>(null);

  // Inicializa el modal de asistencias al montar el componente
  useEffect(() => {
    const modalElement = document.getElementById('asistenciasModal');
    if (modalElement) {
      modalRef.current = new bootstrap.Modal(modalElement);
    }
  }, []);

  // Carga las clases asignadas al profesor
  const cargarClases = async () => {
    const usuario = obtenerUsuario();
    if (!usuario) {
      setCargando(false);
      navigate('/');
      return;
    }

    try {
      const clasesData = await obtenerClases(usuario.id_usuario);
      setClases(clasesData);
    } catch (error) {
      console.error('Error al cargar clases:', error);
      setClases([]);
    } finally {
      setCargando(false);
    }
  };

  // Carga los estudiantes de la clase seleccionada
  const cargarEstudiantes = async (classId: string) => {
    setCargandoEstudiantes(true);
    try {
      // Cargar estudiantes con fotos (incluir_foto=true)
      const estudiantesData = await obtenerEstudiantes(classId, true);
      setEstudiantes(estudiantesData);
      setEstudiantesFiltrados(estudiantesData);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      setEstudiantes([]);
      setEstudiantesFiltrados([]);
    } finally {
      setCargandoEstudiantes(false);
    }
  };

  // Filtra y ordena los estudiantes según búsqueda y orden seleccionados
  useEffect(() => {
    let filtrados = estudiantes;

    // Filtrar por búsqueda
    filtrados = filtrados.filter((est) =>
      `${est.nombre} ${est.apellido}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    );

    // Ordenar
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
  }, [estudiantes, busqueda, orden]);

  useEffect(() => {
    if (location.pathname === '/estudiantes') {
      cargarClases();
    }
  }, [location.pathname]);


  const handleClaseClick = (clase: Clase) => {
    setClaseSeleccionada(clase);
    setBusqueda('');
    cargarEstudiantes(clase.id_clase);
  };

  const handleVolverAClases = () => {
    setClaseSeleccionada(null);
    setBusqueda('');
    setEstudiantes([]);
    setEstudiantesFiltrados([]);
  };

  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusqueda(e.target.value);
  };

  const handleOrdenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOrden(e.target.value as 'asc' | 'desc');
  };

    // Carga y muestra las asistencias recientes de un estudiante
  const handleEstudianteClick = async (estudiante: Estudiante, buttonRef: HTMLButtonElement) => {
    setEstudianteSeleccionado(estudiante);
    setCargandoAsistencias(true);
    setErrorAsistencias(null);

    try {
      if (!claseSeleccionada) {
        setErrorAsistencias('Por favor, selecciona una clase para ver las asistencias.');
        if (modalRef.current) {
          modalRef.current.show();
        }
        return;
      }

      const hoy = new Date();
      const fechaFin = hoy.toISOString().split('T')[0];
      const fechaInicio = new Date(hoy.setDate(hoy.getDate() - 30)).toISOString().split('T')[0];

      const datos = await obtenerAsistenciasEstudiante(claseSeleccionada.id_clase, estudiante.id_estudiante, fechaInicio, fechaFin);

      setResumenAsistencias({
        asistidas: datos.resumen.asistidas || 0,
        ausentes: datos.resumen.ausentes || 0,
      });
      setAsistencias(datos.asistencias.slice(0, 5));

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

      if (modalRef.current) {
        modalRef.current.show();
      }
    } finally {
      setCargandoAsistencias(false);
    }
  };

  const handleCloseModal = () => {
    if (focusAnchorRef.current) {
      focusAnchorRef.current.focus();
    }
    if (modalRef.current) {
      modalRef.current.hide();
    }
  };

  return (
    <div className="container py-5">
      {/* Elemento enfocable para mover el foco al cerrar el modal */}
      <button
        ref={focusAnchorRef}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        aria-label="Volver al contenido principal"
      />

      {claseSeleccionada ? (
        <EstudiantesList
          estudiantes={estudiantes}
          estudiantesFiltrados={estudiantesFiltrados}
          busqueda={busqueda}
          orden={orden}
          onBusquedaChange={handleBusquedaChange}
          onOrdenChange={handleOrdenChange}
          onEstudianteClick={(est, buttonRef) => handleEstudianteClick(est, buttonRef as HTMLButtonElement)}
          onVolver={handleVolverAClases}
          cargando={cargandoEstudiantes}
        />
      ) : (
        <>
          <div className="row mb-5 align-items-center">
            <div className="col-12">
              <h1 className="display-6 fw-bold text-primary mb-2">
                <i className="bi bi-book me-2"></i>Tus Clases
              </h1>
              <p className="lead text-muted">
                Tienes {clases.length} {clases.length === 1 ? 'clase' : 'clases'} asignadas
              </p>
            </div>
          </div>

          {cargando ? (
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-2">Cargando datos...</p>
            </div>
          ) : clases.length === 0 ? (
            <div className="alert alert-info text-center" role="alert">
              No tienes clases asignadas.
            </div>
          ) : (
            <ClasesList clases={clases} onClaseClick={handleClaseClick} />
          )}
        </>
      )}

      {/* Modal de Asistencias */}
      <div
        className="modal fade"
        id="asistenciasModal"
        tabIndex={-1}
        aria-labelledby="asistenciasModalLabel"
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
                onClick={handleCloseModal}
                aria-label="Cerrar"
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
                      <h6 className="text-muted mb-3">Resumen (Últimos 30 días)</h6>
                      <div className="d-flex justify-content-around">
                        <div className="text-center">
                          <p className="mb-1 fw-bold">{resumenAsistencias.asistidas}</p>
                          <small className="text-muted">Asistidas</small>
                        </div>
                        <div className="text-center">
                          <p className="mb-1 fw-bold">{resumenAsistencias.ausentes}</p>
                          <small className="text-muted">Ausentes</small>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted">No hay datos de asistencias disponibles.</p>
                  )}

                  {/* Últimas 5 Asistencias */}
                  <h6 className="text-muted mb-3">Últimas 5 Asistencias</h6>
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
                              asistencia.estado === 'confirmado' ? 'bg-success' : 'bg-danger'
                            } rounded-pill`}
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
                onClick={handleCloseModal}
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaginaEstudiantes;