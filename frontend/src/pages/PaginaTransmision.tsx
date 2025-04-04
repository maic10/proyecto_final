// src/pages/PaginaTransmision.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../state/auth';
import { obtenerClases, obtenerAsistenciasActual, actualizarEstadoAsistencia, verificarEstadoTransmision } from '../state/api';
import { formatInTimeZone } from 'date-fns-tz';

interface RegistroAsistencia {
  id_estudiante: string;
  estado: string;
  confianza: number | null;
  fecha_deteccion: string | null;
  modificado_por_usuario?: string | null;
  modificado_fecha?: string | null;
}

const API_BASE = 'http://127.0.0.1:5000/api';

const PaginaTransmision: React.FC = () => {
  const [idClase, setIdClase] = useState<string | null>(null); // Almacenar el id_clase dinámicamente
   // Obtenemos la fecha actual en la zona horaria de Madrid
  const fechaActual = formatInTimeZone(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  const navigate = useNavigate();

  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [hayTransmision, setHayTransmision] = useState(false);
  const [mostrarVideo, setMostrarVideo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Cargar el id_clase al montar el componente
  useEffect(() => {
    const cargarClase = async () => {
      const usuario = obtenerUsuario();
      if (!usuario) {
        navigate('/');
        return;
      }

      try {
        const clases = await obtenerClases(usuario.id_usuario);
        if (clases.length > 0) {
          setIdClase(clases[0].id_clase); // Tomar la primera clase del profesor
        } else {
          setError('No tienes clases asignadas.');
          setCargando(false);
        }
      } catch (err) {
        console.error('Error al cargar las clases:', err);
        setError('Error al cargar las clases del profesor.');
        setCargando(false);
      }
    };

    cargarClase();
  }, [navigate]);

  // Cargar el estado de la transmisión y las asistencias una vez que tengamos el id_clase
  const cargarDatosIniciales = async () => {
    if (!idClase) return; // No hacer nada si no tenemos id_clase

    setCargando(true);
    setError('');
    try {
      // Verificar estado de la transmisión
      const estadoTransmision = await verificarEstadoTransmision(idClase);
      setHayTransmision(estadoTransmision.transmitir);
      setMostrarVideo(estadoTransmision.transmitir);

      // Cargar asistencias actuales
      const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
      setRegistros(asistencia.registros || []);
    } catch (err) {
      console.error('Error al cargar datos iniciales:', err);
      setError('Error al cargar los datos iniciales');
    } finally {
      setCargando(false);
    }
  };

  // Actualizar las asistencias periódicamente
  useEffect(() => {
    if (idClase) {
      cargarDatosIniciales();
      const intervalAsistencias = setInterval(async () => {
        try {
          const asistencia = await obtenerAsistenciasActual(idClase, fechaActual);
          setRegistros(asistencia.registros || []);
        } catch (err) {
          console.error('Error al actualizar asistencias:', err);
        }
      }, 5000); // Actualizar cada 5 segundos

      return () => clearInterval(intervalAsistencias);
    }
  }, [idClase]);

  // Verificar el estado de la transmisión periódicamente
  useEffect(() => {
    if (idClase) {
      const intervalTransmision = setInterval(async () => {
        try {
          const estadoTransmision = await verificarEstadoTransmision(idClase);
          setHayTransmision(estadoTransmision.transmitir);
        } catch (err) {
          console.error('Error al verificar estado de transmisión:', err);
          setHayTransmision(false);
        }
      }, 10000); // Verificar cada 10 segundos

      return () => clearInterval(intervalTransmision);
    }
  }, [idClase]);

  // Manejar el cambio de estado de un estudiante
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

  return (
    <div className="container py-4">
      <h2 className="mb-4">Transmisión en Tiempo Real {idClase ? `- Clase ${idClase}` : ''}</h2>

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
                    <th>Confianza</th>
                    <th>Fecha de Detección</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr key={registro.id_estudiante}>
                      <td>{registro.id_estudiante}</td>
                      <td>{registro.estado}</td>
                      <td>{registro.confianza ? registro.confianza.toFixed(2) : 'N/A'}</td>
                      <td>{registro.fecha_deteccion || 'N/A'}</td>
                      <td>
                        <select
                          value={registro.estado}
                          onChange={(e) => handleCorregirEstado(registro.id_estudiante, e.target.value)}
                          className="form-select"
                        >
                          <option value="confirmado">Confirmado</option>
                          <option value="duda">Duda</option>
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