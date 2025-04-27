// src/pages/PaginaTransmision.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { obtenerClases, obtenerAsistenciasActual, actualizarEstadoAsistencia, verificarEstadoTransmision, obtenerEstudiantes, ajustarTiempoMaximo } from '../../state/api';
import { formatInTimeZone } from 'date-fns-tz';
import { Clase, Horario } from '../../types/clases';
import { Estudiante } from '../../types/estudiantes';
import { RegistroAsistencia } from '../../types/asistencias';
import { API_BASE } from '../../utils/constants';

const PaginaTransmision: React.FC = () => {
  const [idClase, setIdClase] = useState<string | null>(null);
  const [nombreClase, setNombreClase] = useState<string>('');
  const [clases, setClases] = useState<Clase[]>([]);
  const fechaActual = formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  const navigate = useNavigate();

  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [hayTransmision, setHayTransmision] = useState(false);
  const [mostrarVideo, setMostrarVideo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Estado para el ajuste del tiempo máximo
  const [tiempoMaximo, setTiempoMaximo] = useState<number>(10); // Valor por defecto: 10 minutos
  const [puedeAjustar, setPuedeAjustar] = useState<boolean>(true); // Controla si el ajuste es posible
  const [tiempoInicio, setTiempoInicio] = useState<number | null>(null); // Tiempo de inicio de la transmisión

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

        for (const clase of clasesData) {
          for (const horario of clase.horarios) {
            const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
            if (diaHorario !== diaActual) continue;

            const [horaInicio, minutosInicio] = horario.hora_inicio.split(':').map(Number);
            const [horaFin, minutosFin] = horario.hora_fin.split(':').map(Number);
            const inicioSegundos = horaInicio * 3600 + minutosInicio * 60;
            let finSegundos = horaFin * 3600 + minutosFin * 60;

            const cruzaMedianoche = finSegundos < inicioSegundos;
            if (cruzaMedianoche) {
              if (horaActual >= inicioSegundos || horaActual <= finSegundos) {
                const estadoTransmision = await verificarEstadoTransmision(clase.id_clase);
                if (estadoTransmision.transmitir) {
                  claseActiva = clase;
                  break;
                }
              }
            } else {
              if (inicioSegundos <= horaActual && horaActual <= finSegundos) {
                const estadoTransmision = await verificarEstadoTransmision(clase.id_clase);
                if (estadoTransmision.transmitir) {
                  claseActiva = clase;
                  break;
                }
              }
            }
          }
          if (claseActiva) break;
        }

        if (!claseActiva) {
          for (const clase of clasesData) {
            for (const horario of clase.horarios) {
              const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
              const [hora, minutos] = horario.hora_inicio.split(':').map(Number);
              const fechaInicio = new Date(ahora);
              fechaInicio.setHours(hora, minutos, 0, 0);

              const diasDiferencia = (diaHorario - diaActual + 7) % 7;
              if (diasDiferencia === 0 && fechaInicio < ahora) {
                fechaInicio.setDate(fechaInicio.getDate() + 7);
              } else {
                fechaInicio.setDate(fechaInicio.getDate() + diasDiferencia);
              }

              if (!fechaInicioMasProxima || fechaInicio < fechaInicioMasProxima) {
                fechaInicioMasProxima = fechaInicio;
                claseMasProxima = clase;
              }
            }
          }
        }

        const claseSeleccionada = claseActiva || claseMasProxima;
        if (claseSeleccionada) {
          setIdClase(claseSeleccionada.id_clase);
          setNombreClase(claseSeleccionada.nombre_asignatura);

          const estudiantesData = await obtenerEstudiantes(claseSeleccionada.id_clase);
          setEstudiantes(estudiantesData);
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
      const estadoTransmision = await verificarEstadoTransmision(idClase);
      setHayTransmision(estadoTransmision.transmitir);
      setMostrarVideo(estadoTransmision.transmitir);

      if (estadoTransmision.transmitir) {
        setTiempoInicio(Date.now());
        const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
        setRegistros(asistencia.registros || []);
      } else {
        setRegistros([]);
        setTiempoInicio(null);
      }
    } catch (err) {
      console.error('Error al cargar datos de transmisión:', err);
      setError('Error al cargar el estado de transmisión o asistencias');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (idClase) {
      cargarDatosTransmision();
    }
  }, [idClase]);

  // Actualizar asistencias solo cuando hay transmisión
  useEffect(() => {
    if (idClase && hayTransmision) {
      const intervalAsistencias = setInterval(async () => {
        try {
          const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
          setRegistros(asistencia.registros || []);
        } catch (err) {
          console.error('Error al actualizar asistencias:', err);
        }
      }, 5000);

      return () => clearInterval(intervalAsistencias);
    }
  }, [idClase, hayTransmision]);

  // Verificar estado de transmisión periódicamente
  useEffect(() => {
    if (idClase) {
      const intervalTransmision = setInterval(async () => {
        try {
          const estadoTransmision = await verificarEstadoTransmision(idClase);
          setHayTransmision(estadoTransmision.transmitir);
          if (!estadoTransmision.transmitir) {
            setRegistros([]);
            setTiempoInicio(null);
          }
        } catch (err) {
          console.error('Error al verificar estado de transmisión:', err);
          setHayTransmision(false);
          setRegistros([]);
          setTiempoInicio(null);
        }
      }, 10000);

      return () => clearInterval(intervalTransmision);
    }
  }, [idClase]);

  // Controlar si el ajuste del tiempo máximo es posible (primeros 5 minutos)
  useEffect(() => {
    if (hayTransmision && tiempoInicio) {
      const interval = setInterval(() => {
        const tiempoTranscurrido = (Date.now() - tiempoInicio) / 1000; // En segundos
        if (tiempoTranscurrido > 300) { // 5 minutos = 300 segundos
          setPuedeAjustar(false);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [hayTransmision, tiempoInicio]);

  // Manejar el cambio del tiempo máximo
  const handleAjustarTiempoMaximo = async () => {
    if (!idClase || !puedeAjustar) return;

    const tiempoMaximoNum = Number(tiempoMaximo);
    if (isNaN(tiempoMaximoNum) || tiempoMaximoNum <= 0) {
      setError('El tiempo máximo debe ser un número positivo');
      return;
    }

    try {
      const response = await ajustarTiempoMaximo(idClase, tiempoMaximoNum);
      console.log('Tiempo máximo ajustado:', response);
      setError('');
    } catch (err) {
      console.error('Error al ajustar tiempo máximo:', err);
      setError('Error al ajustar el tiempo máximo: ' + (err.response?.data?.error || err.message));
    }
  };

  // Manejar cambio de estado
  const handleCorregirEstado = async (idEstudiante: string, nuevoEstado: string) => {
    if (!idClase) return;

    try {
      await actualizarEstadoAsistencia(idEstudiante, idClase, fechaActual, nuevoEstado);
      const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
      setRegistros(asistencia.registros || []);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar el estado del estudiante');
    }
  };

  // Obtener nombre completo del estudiante
  const obtenerNombreEstudiante = (idEstudiante: string) => {
    const estudiante = estudiantes.find((e) => e.id_estudiante === idEstudiante);
    return estudiante ? `${estudiante.nombre} ${estudiante.apellido}` : idEstudiante;
  };

  // Formatear fecha_deteccion a un formato legible
  const formatearFechaDeteccion = (fecha: string | null) => {
    if (!fecha) return 'N/A';
    const fechaObj = new Date(fecha);
    return formatInTimeZone(fechaObj, 'Europe/Madrid', 'dd/MM/yyyy HH:mm');
  };

  return (
    <div className="container py-4">
      {/* Encabezado con estilo Bootstrap mejorado */}
      <div className="bg-primary text-white p-4 rounded shadow mb-4">
        <h2 className="mb-0">Transmisión en Tiempo Real {nombreClase ? `- ${nombreClase}` : ''}</h2>
      </div>

      {error && <div className="alert alert-danger alert-dismissible fade show" role="alert">{error}</div>}
      {cargando && <p className="text-muted text-center">Cargando datos...</p>}

      {!cargando && idClase && (
        <>
          {/* Sección de video */}
          <div className="card shadow mb-4">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="card-title mb-0">Video en Tiempo Real</h4>
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
                  <p className="text-muted text-center">Video oculto para optimizar el rendimiento. Haz clic en "Mostrar Video" para verlo.</p>
                )
              ) : (
                <p className="text-muted text-center">No hay transmisión activa en este momento.</p>
              )}
            </div>
          </div>

          {/* Sección para ajustar el tiempo máximo */}
          {hayTransmision && (
            <div className="card shadow mb-4">
              <div className="card-body">
                <h4 className="card-title mb-3">Ajustar Tiempo Máximo para Detecciones a Tiempo</h4>
                {puedeAjustar ? (
                  <div className="d-flex align-items-center">
                    <input
                      type="number"
                      className="form-control me-2"
                      value={tiempoMaximo}
                      onChange={(e) => setTiempoMaximo(Number(e.target.value))}
                      min="1"
                      step="1"
                      required
                      style={{ width: '100px' }}
                    />
                    <span className="me-2">minutos</span>
                    <button
                      className="btn btn-success"
                      onClick={handleAjustarTiempoMaximo}
                    >
                      Ajustar
                    </button>
                  </div>
                ) : (
                  <p className="text-muted">El tiempo máximo solo puede ajustarse en los primeros 5 minutos de la clase.</p>
                )}
              </div>
            </div>
          )}

          {/* Sección de asistencias */}
          <div className="card shadow">
            <div className="card-body">
              <h4 className="card-title mb-3">Asistencias en Tiempo Real</h4>
              {registros.length === 0 ? (
                <p className="text-muted text-center">No hay asistencias registradas para esta clase y fecha.</p>
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
                            <span className={`badge ${
                              registro.estado === "confirmado" ? "bg-success" :
                              registro.estado === "tarde" ? "bg-warning" :
                              "bg-danger"
                            }`}>
                              {registro.estado === "confirmado" ? "Confirmado" : registro.estado === "tarde" ? "Tarde" : "Ausente"}
                            </span>
                          </td>
                          <td>{formatearFechaDeteccion(registro.fecha_deteccion)}</td>
                          <td>{formatearFechaDeteccion(registro.fecha_deteccion_tardia)}</td>
                          <td>{formatearFechaDeteccion(registro.modificado_fecha)}</td>
                          <td>
                            <select
                              value={registro.estado}
                              onChange={(e) => handleCorregirEstado(registro.id_estudiante, e.target.value)}
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