// src/pages/PaginaTransmision.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../state/auth';
import { obtenerClases, obtenerAsistenciasActual, actualizarEstadoAsistencia, verificarEstadoTransmision, obtenerEstudiantesPorClase } from '../state/api';
import { formatInTimeZone } from 'date-fns-tz';

interface RegistroAsistencia {
  id_estudiante: string;
  estado: string;
  confianza: number | null;
  fecha_deteccion: string | null;
  modificado_por_usuario?: string | null;
  modificado_fecha?: string | null;
}

interface Estudiante {
  id_estudiante: string;
  nombre: string;
  apellido: string;
}

interface Clase {
  id_clase: string;
  nombre: string;
}

const API_BASE = 'http://127.0.0.1:5000/api';

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

  // Cargar id_clase, nombre de clase y estudiantes al montar el componente
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      const usuario = obtenerUsuario();
      if (!usuario) {
        navigate('/');
        return;
      }

      try {
        const clasesData = await obtenerClases(usuario.id_usuario);
        if (clasesData.length > 0) {
          setClases(clasesData);
          const claseSeleccionada = clasesData[0];
          setIdClase(claseSeleccionada.id_clase);
          setNombreClase(claseSeleccionada.nombre);

          const estudiantesData = await obtenerEstudiantesPorClase(claseSeleccionada.id_clase);
          setEstudiantes(estudiantesData);
        } else {
          setError('No tienes clases asignadas.');
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
          }
        } catch (err) {
          console.error('Error al verificar estado de transmisión:', err);
          setHayTransmision(false);
          setRegistros([]);
        }
      }, 10000);

      return () => clearInterval(intervalTransmision);
    }
  }, [idClase]);

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
      <h2 className="mb-4">Transmisión en Tiempo Real {nombreClase ? `- ${nombreClase}` : ''}</h2>

      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && <p>Cargando datos...</p>}

      {!cargando && idClase && (
        <>
          {/* Sección de video */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4>Video en Tiempo Real</h4>
              {hayTransmision && (
                <button
                  className="btn btn-secondary"
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
                    className="img-fluid border rounded"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              ) : (
                <p className="text-muted text-center">Video oculto para optimizar el rendimiento. Haz clic en "Mostrar Video" para verlo.</p>
              )
            ) : (
              <p className="text-muted text-center">No hay transmisión activa en este momento.</p>
            )}
          </div>

          {/* Sección de asistencias */}
          <div>
            <h4>Asistencias en Tiempo Real</h4>
            {registros.length === 0 ? (
              <p>No hay asistencias registradas para esta clase y fecha.</p>
            ) : (
              <table className="table table-striped table-bordered">
                <thead className="table-primary">
                  <tr>
                    <th>Estudiante</th>
                    <th>Estado</th>
                    <th>Fecha de Detección</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr key={registro.id_estudiante}>
                      <td>{obtenerNombreEstudiante(registro.id_estudiante)}</td>
                      <td>{registro.estado}</td>
                      <td>{formatearFechaDeteccion(registro.fecha_deteccion)}</td>
                      <td>
                        <select
                          value={registro.estado}
                          onChange={(e) => handleCorregirEstado(registro.id_estudiante, e.target.value)}
                          className="form-select"
                        >
                          <option value="confirmado">Confirmado</option>
                          <option value="ausente">Ausente</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PaginaTransmision;