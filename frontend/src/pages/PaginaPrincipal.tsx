// src/pages/PaginaPrincipal.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerPerfil, obtenerClases } from '../state/api';
import { obtenerUsuario } from '../state/auth';

interface Horario {
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  id_aula: string;
  nombre_aula: string;
}

interface Clase {
  id_clase: string;
  nombre: string;
  horarios: Horario[];
}

function PaginaPrincipal() {
  const [nombre, setNombre] = useState('');
  const [clase, setClase] = useState<Clase | null>(null);
  const [proximaClase, setProximaClase] = useState<{ horario: Horario; tiempoRestante: string } | null>(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const cargarDatos = async () => {
    const usuario = obtenerUsuario();
    if (!usuario) {
      navigate('/');
      return;
    }

    try {
      const perfil = await obtenerPerfil();
      setNombre(perfil.name);

      const clasesData = await obtenerClases(usuario.id_usuario);
      if (clasesData.length > 0) {
        setClase(clasesData[0]); // Solo tomamos la primera clase
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      navigate('/');
    } finally {
      setCargando(false);
    }
  };

  // Calcular la próxima clase y actualizar el temporizador
  useEffect(() => {
    if (clase) {
      const calcularProximaClase = () => {
        const ahora = new Date();
        const diaActual = ahora.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
        const diasSemana = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // Mapear horarios a fechas futuras
        const horariosFuturos = clase.horarios.map((horario) => {
          const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
          const [hora, minutos] = horario.hora_inicio.split(':').map(Number);
          const fechaInicio = new Date(ahora);
          fechaInicio.setHours(hora, minutos, 0, 0);

          // Ajustar el día al próximo día de la semana correspondiente
          const diasDiferencia = (diaHorario - diaActual + 7) % 7;
          if (diasDiferencia === 0 && fechaInicio < ahora) {
            // Si es hoy pero ya pasó, añadir una semana
            fechaInicio.setDate(fechaInicio.getDate() + 7);
          } else {
            fechaInicio.setDate(fechaInicio.getDate() + diasDiferencia);
          }

          return { horario, fechaInicio };
        });

        // Encontrar la próxima clase
        horariosFuturos.sort((a, b) => a.fechaInicio - b.fechaInicio);
        const proxima = horariosFuturos[0];

        if (!proxima) return;

        // Calcular tiempo restante
        const diferenciaMs = proxima.fechaInicio - ahora;
        const dias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferenciaMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferenciaMs % (1000 * 60)) / 1000);

        let tiempoRestante = '';
        if (dias > 0) tiempoRestante += `${dias}d `;
        if (horas > 0 || dias > 0) tiempoRestante += `${horas}h `;
        tiempoRestante += `${minutos}m ${segundos}s`;

        setProximaClase({ horario: proxima.horario, tiempoRestante });
      };

      // Calcular inicialmente y luego cada segundo
      calcularProximaClase();
      const interval = setInterval(calcularProximaClase, 1000);

      return () => clearInterval(interval);
    }
  }, [clase]);

  useEffect(() => {
    if (location.pathname === '/inicio') {
      cargarDatos();
    }
  }, [location.pathname]);

  return (
    <div className="container py-5">
      {cargando ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando datos...</p>
        </div>
      ) : (
        <>
          {/* Encabezado */}
          <div className="row mb-5 align-items-center">
            <div className="col-12 text-center">
              <h1 className="display-4 fw-bold text-primary mb-2">
                ¡Hola, {nombre}!
              </h1>
              <p className="lead text-muted">
                Aquí tienes la información de tu clase asignada
              </p>
            </div>
          </div>

          {/* Clase Asignada */}
          {clase ? (
            <div className="row justify-content-center">
              <div className="col-md-8 col-lg-6">
                <div
                  className="card shadow-lg border-0"
                  style={{
                    borderRadius: '15px',
                    backgroundColor: '#f8f9fa',
                  }}
                >
                  <div
                    className="card-header text-white text-center"
                    style={{
                      backgroundColor: '#007bff',
                      borderTopLeftRadius: '15px',
                      borderTopRightRadius: '15px',
                    }}
                  >
                    <h3 className="card-title mb-0">{clase.nombre}</h3>
                  </div>
                  <div className="card-body">
                    {/* Temporizador */}
                    {proximaClase ? (
                      <div className="text-center mb-4">
                        <h5 className="text-muted">
                          <i className="bi bi-clock me-2"></i>Próxima Clase
                        </h5>
                        <p className="fs-4 fw-bold text-primary">
                          {proximaClase.tiempoRestante}
                        </p>
                        <p className="text-muted">
                          {proximaClase.horario.dia.charAt(0).toUpperCase() + proximaClase.horario.dia.slice(1)} a las {proximaClase.horario.hora_inicio}
                        </p>
                      </div>
                    ) : (
                      <p className="text-center text-muted mb-4">No hay clases próximas programadas</p>
                    )}

                    {/* Horarios */}
                    <h5 className="text-muted mb-3">
                      <i className="bi bi-calendar3 me-2"></i>Horarios
                    </h5>
                    {clase.horarios.length > 0 ? (
                      <ul className="list-group list-group-flush">
                        {clase.horarios.map((h, idx) => (
                          <li key={idx} className="list-group-item border-0 px-0 py-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{h.dia.charAt(0).toUpperCase() + h.dia.slice(1)}:</strong>{' '}
                                {h.hora_inicio} - {h.hora_fin}
                                <br />
                                <small className="text-muted">Aula: {h.nombre_aula}</small>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted">Sin horarios definidos</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-info text-center" role="alert">
              No tienes clases asignadas actualmente.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PaginaPrincipal;