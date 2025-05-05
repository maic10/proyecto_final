// src/pages/PaginaTransmision.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import {
  obtenerClases,
  obtenerAsistenciasActual,
  actualizarEstadoAsistencia,
  verificarEstadoTransmision,
  obtenerEstudiantes
} from '../../state/api';
import { formatInTimeZone } from 'date-fns-tz';
import { Clase, Horario } from '../../types/clases';
import { Estudiante } from '../../types/estudiantes';
import { RegistroAsistencia } from '../../types/asistencias';
import { API_BASE } from '../../utils/constants';

const PaginaTransmision: React.FC = () => {
  const [idClase, setIdClase] = useState<string | null>(null);
  const [nombreClase, setNombreClase] = useState<string>('');
  const [nombreAula, setNombreAula] = useState<string>(''); // <-- nuevo estado para el aula
  const [clases, setClases] = useState<Clase[]>([]);
  const fechaActual = formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  const navigate = useNavigate();

  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [hayTransmision, setHayTransmision] = useState(false);
  const [mostrarVideo, setMostrarVideo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [showInfo, setShowInfo] = useState<boolean>(false); // Estado para mostrar/ocultar explicación

  // Cargar clases y determinar la clase activa o más próxima
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      const usuario = obtenerUsuario();
      if (!usuario) {
        navigate('/');
        return;
      }

      try {
        const clasesData = await obtenerClases(usuario.id_usuario);
        if (clasesData.length === 0) {
          setError('No tienes clases asignadas.');
          setCargando(false);
          return;
        }

        setClases(clasesData);

        const ahora = new Date();
        const diaActual = ahora.getDay();
        const diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        const horaActual = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds();

        let claseActiva: Clase | null = null;
        let claseMasProxima: Clase | null = null;
        let fechaInicioMasProxima: Date | null = null;
        let aulaSeleccionada = ''; // <-- variable temporal para el aula

        // Buscar clase activa hoy
        for (const clase of clasesData) {
          for (const horario of clase.horarios) {
            const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
            if (diaHorario !== diaActual) continue;

            const [horaI, minI] = horario.hora_inicio.split(':').map(Number);
            const [horaF, minF] = horario.hora_fin.split(':').map(Number);
            const inicioSeg = horaI * 3600 + minI * 60;
            let finSeg = horaF * 3600 + minF * 60;
            const cruzaMedianoche = finSeg < inicioSeg;
            const dentro = cruzaMedianoche
              ? (horaActual >= inicioSeg || horaActual <= finSeg)
              : (inicioSeg <= horaActual && horaActual <= finSeg);
            if (!dentro) continue;

            const estado = await verificarEstadoTransmision(clase.id_clase);
            if (estado.transmitir) {
              claseActiva = clase;
              aulaSeleccionada = horario.nombre_aula; // guardamos aula de este horario
              break;
            }
          }
          if (claseActiva) break;
        }

        // Si no hay transmisión activa, buscar próxima clase
        if (!claseActiva) {
          for (const clase of clasesData) {
            for (const horario of clase.horarios) {
              const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
              const [h, m] = horario.hora_inicio.split(':').map(Number);
              const inicioFecha = new Date(ahora);
              inicioFecha.setHours(h, m, 0, 0);

              let diffDias = (diaHorario - diaActual + 7) % 7;
              if (diffDias === 0 && inicioFecha < ahora) diffDias = 7;
              inicioFecha.setDate(inicioFecha.getDate() + diffDias);

              if (!fechaInicioMasProxima || inicioFecha < fechaInicioMasProxima) {
                fechaInicioMasProxima = inicioFecha;
                claseMasProxima = clase;
                aulaSeleccionada = horario.nombre_aula; // guardamos aula para próxima clase
              }
            }
          }
        }

        const claseSeleccionada = claseActiva || claseMasProxima;
        if (claseSeleccionada) {
          setIdClase(claseSeleccionada.id_clase);
          setNombreClase(claseSeleccionada.nombre_asignatura);
          setNombreAula(aulaSeleccionada); // <-- guardamos nombre del aula

          const estuds = await obtenerEstudiantes(claseSeleccionada.id_clase);
          setEstudiantes(estuds);
        } else {
          setError('No hay clases próximas programadas.');
          setCargando(false);
        }
      } catch (err) {
        console.error('Error al cargar datos iniciales:', err);
        setError('Error al cargar las clases o estudiantes.');
        setCargando(false);
      }
    };

    cargarDatosIniciales();
  }, [navigate]);

  // Cargar estado inicial de transmisión y asistencias
  const cargarDatosTransmision = async () => {
    if (!idClase) return;

    setCargando(true);
    setError('');
    try {
      const estado = await verificarEstadoTransmision(idClase);
      setHayTransmision(estado.transmitir);
      setMostrarVideo(estado.transmitir);

      if (estado.transmitir) {
        const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
        setRegistros(asistencia.registros || []);
      } else {
        setRegistros([]);
      }
    } catch (err) {
      console.error('Error al cargar datos de transmisión:', err);
      setError('Error al cargar el estado de transmisión o asistencias');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (idClase) cargarDatosTransmision();
  }, [idClase]);

  // Actualizar asistencias solo cuando hay transmisión
  useEffect(() => {
    if (idClase && hayTransmision) {
      const intervalo = setInterval(async () => {
        try {
          const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
          setRegistros(asistencia.registros || []);
        } catch (err) {
          console.error('Error al actualizar asistencias:', err);
        }
      }, 5000);
      return () => clearInterval(intervalo);
    }
  }, [idClase, hayTransmision]);

  // Verificar estado de transmisión cada 5 segundos
  useEffect(() => {
    if (!idClase) return;
    const intervalo = setInterval(async () => {
      try {
        const estado = await verificarEstadoTransmision(idClase);
        setHayTransmision(estado.transmitir);
        if (!estado.transmitir) {
          setRegistros([]);
          setMostrarVideo(false);
        }
      } catch (err) {
        console.error('Error al verificar estado de transmisión:', err);
        setHayTransmision(false);
        setRegistros([]);
        setMostrarVideo(false);
      }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [idClase]);

  // Cuando la transmisión termina, limpiamos inmediatamente
  useEffect(() => {
    if (!hayTransmision) {
      setRegistros([]);
      setMostrarVideo(false);
    }
  }, [hayTransmision]);

  // Manejar corrección manual de estado
  const handleCorregirEstado = async (idEstudiante: string, nuevoEstado: string) => {
    if (!idClase) return;
    try {
      await actualizarEstadoAsistencia(idEstudiante, idClase, fechaActual, nuevoEstado);
      const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
      setRegistros(asistencia.registros || []);
    } catch {
      alert('Error al actualizar el estado del estudiante');
    }
  };

  // Obtener nombre completo del estudiante
  const obtenerNombreEstudiante = (idEstudiante: string) => {
    const e = estudiantes.find((x) => x.id_estudiante === idEstudiante);
    return e ? `${e.nombre} ${e.apellido}` : idEstudiante;
  };

  // Formatear fecha de detección
  const formatearFechaDeteccion = (fecha: string | null) => {
    if (!fecha) return 'N/A';
    return formatInTimeZone(new Date(fecha), 'Europe/Madrid', 'dd/MM/yyyy HH:mm');
  };

  return (
    <div className="container py-4">
      {/* Encabezado con estiloBootstrap mejorado */}
      <div className="bg-light p-4 rounded shadow mb-4">
        <h2 className="display-6 fw-bold text-primary mb-0">
          Transmisión en Tiempo Real
          {hayTransmision && nombreClase ? ` - ${nombreClase}` : ''}
          {hayTransmision && nombreAula ? ` (Aula: ${nombreAula})` : ''}
        </h2>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
        </div>
      )}
      {cargando && <p className="text-muted text-center">Cargando datos...</p>}

      {!cargando && idClase && (
        <>
          {/* Sección de video */}
          <div className="card shadow mb-4">
            <div className="card-body">
              <div className="bg-light p-4 rounded shadow mb-4">
                <h4 className="display-6 fw-bold text-primary mb-0">Video en Tiempo Real</h4>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                {hayTransmision && (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setMostrarVideo(!mostrarVideo)}
                  >
                    {mostrarVideo ? 'Ocultar Video' : 'Mostrar Video'}
                  </button>
                )}
              </div>
              {hayTransmision ? (
                mostrarVideo ? (
                  <div className="text-center">
                    <img
                      src={`${API_BASE}/transmision/video/${idClase}`}
                      alt="Video en tiempo real"
                      className="img-fluid rounded border shadow-sm"
                    />
                  </div>
                ) : (
                  <p className="text-muted text-center">
                    Video oculto para optimizar el rendimiento. Haz clic en "Mostrar Video" para verlo.
                  </p>
                )
              ) : (
                <p className="text-muted text-center">
                  No hay transmisión activa en este momento.
                </p>
              )}
            </div>
          </div>

          {/* Sección de asistencias */}
          <div className="card shadow">
            <div className="card-body">
              <div className="bg-light p-4 rounded shadow mb-4">
                <h4 className="display-6 fw-bold text-primary mb-0">
                  Asistencias en Tiempo Real{' '}
                  <button
                    type="button"
                    className="btn btn-link p-0 align-baseline"
                    style={{ fontSize: '1.2rem' }}
                    onClick={() => setShowInfo(!showInfo)}
                  >
                    ℹ️
                  </button>
                </h4>
              </div>

              {showInfo && (
                <p className="text-muted small mb-3">
                  Las detecciones que lleguen después de 10 minutos desde el inicio se marcarán automáticamente como <strong>"Tarde"</strong>.
                </p>
              )}

              {registros.length === 0 ? (
                <p className="text-muted text-center">
                  No hay asistencias registradas para esta clase y fecha.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-bordered table-hover">
                    <thead className="table-primary">
                      <tr>
                        <th>Estudiante</th>
                        <th>Estado</th>
                        <th>Fecha de Detección (A tiempo)</th>
                        <th>Fecha de Detección (Tardía)</th>
                        <th>Fecha de Modificación</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((registro) => (
                        <tr key={registro.id_estudiante}>
                          <td>{obtenerNombreEstudiante(registro.id_estudiante)}</td>
                          <td>
                            <span
                              className={`badge ${
                                registro.estado === 'confirmado'
                                  ? 'bg-success'
                                  : registro.estado === 'tarde'
                                  ? 'bg-warning'
                                  : 'bg-danger'
                              }`}
                            >
                              {registro.estado === 'confirmado'
                                ? 'Confirmado'
                                : registro.estado === 'tarde'
                                ? 'Tarde'
                                : 'Ausente'}
                            </span>
                          </td>
                          <td>{formatearFechaDeteccion(registro.fecha_deteccion)}</td>
                          <td>{formatearFechaDeteccion(registro.fecha_deteccion_tardia)}</td>
                          <td>{formatearFechaDeteccion(registro.modificado_fecha)}</td>
                          <td>
                            <select
                              value={registro.estado}
                              onChange={(e) =>
                                handleCorregirEstado(registro.id_estudiante, e.target.value)
                              }
                              className="form-select form-select-sm"
                            >
                              <option value="confirmado">Confirmado</option>
                              <option value="tarde">Tarde</option>
                              <option value="ausente">Ausente</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaginaTransmision;
