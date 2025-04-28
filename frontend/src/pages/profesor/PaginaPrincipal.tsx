// src/pages/PaginaPrincipal.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerPerfil, obtenerClases } from '../../state/api';
import { obtenerUsuario } from '../../state/auth';
import ClaseCard from '../../components/clases/ClaseCard';
import { Clase, Horario } from '../../types/clases';

function PaginaPrincipal() {
  const [nombre, setNombre] = useState('');
  const [clases, setClases] = useState<Clase[]>([]);
  const [claseActiva, setClaseActiva] = useState<{ clase: Clase; horario: Horario } | null>(null);
  const [proximaClase, setProximaClase] = useState<{ clase: Clase; horario: Horario; tiempoRestante: string } | null>(null);
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
      console.log('Clases obtenidas:', clasesData);
      setClases(clasesData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      navigate('/');
    } finally {
      setCargando(false);
    }
  };

  // Calcular clase activa o próxima y actualizar el temporizador
  useEffect(() => {
    if (clases.length > 0) {
      const calcularClaseActivaOProxima = () => {
        const ahora = new Date();
        const diaActual = ahora.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const horaActual = ahora.getHours() * 3600 + ahora.getMinutes() * 60 + ahora.getSeconds(); // Hora actual en segundos

        // 1. Buscar una clase activa en el momento actual
        let claseActivaEncontrada: { clase: Clase; horario: Horario } | null = null;
        for (const clase of clases) {
          for (const horario of clase.horarios) {
            const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
            if (diaHorario === -1) {
              console.error(`Día inválido en horario: ${horario.dia}`);
              continue; // Saltar horarios con días inválidos
            }
            if (diaHorario !== diaActual) continue;

            const [horaInicio, minutosInicio] = horario.hora_inicio.split(':').map(Number);
            const [horaFin, minutosFin] = horario.hora_fin.split(':').map(Number);
            const inicioSegundos = horaInicio * 3600 + minutosInicio * 60;
            let finSegundos = horaFin * 3600 + minutosFin * 60;

            // Manejar horarios que cruzan la medianoche
            const cruzaMedianoche = finSegundos < inicioSegundos;
            if (cruzaMedianoche) {
              // Si cruza la medianoche, el horario termina el día siguiente
              if (horaActual >= inicioSegundos || horaActual <= finSegundos) {
                claseActivaEncontrada = { clase, horario };
                break;
              }
            } else {
              // Caso normal: horario dentro del mismo día
              if (inicioSegundos <= horaActual && horaActual <= finSegundos) {
                claseActivaEncontrada = { clase, horario };
                break;
              }
            }
          }
          if (claseActivaEncontrada) break;
        }

        if (claseActivaEncontrada) {
          setClaseActiva(claseActivaEncontrada);
          setProximaClase(null); // No mostramos próxima clase si hay una activa
          return;
        }

        // 2. Si no hay clase activa, buscar la próxima clase
        setClaseActiva(null);
        const horariosFuturos: { clase: Clase; horario: Horario; fechaInicio: Date }[] = [];
        clases.forEach((clase) => {
          clase.horarios.forEach((horario) => {
            const diaHorario = diasSemana.indexOf(horario.dia.toLowerCase());
            if (diaHorario === -1) {
              console.error(`Día inválido en horario: ${horario.dia}`);
              return; // Saltar horarios con días inválidos
            }
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

            horariosFuturos.push({ clase, horario, fechaInicio });
          });
        });

        // Encontrar la próxima clase
        horariosFuturos.sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime());
        const proxima = horariosFuturos[0];

        if (!proxima) {
          setProximaClase(null);
          return;
        }

        // Calcular tiempo restante
        const diferenciaMs = proxima.fechaInicio.getTime() - ahora.getTime();
        const dias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferenciaMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferenciaMs % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferenciaMs % (1000 * 60)) / 1000);

        let tiempoRestante = '';
        if (dias > 0) tiempoRestante += `${dias}d `;
        if (horas > 0 || dias > 0) tiempoRestante += `${horas}h `;
        tiempoRestante += `${minutos}m ${segundos}s`;

        setProximaClase({ clase: proxima.clase, horario: proxima.horario, tiempoRestante });
      };

      // Calcular inicialmente y luego cada segundo
      calcularClaseActivaOProxima();
      const interval = setInterval(calcularClaseActivaOProxima, 1000);

      return () => clearInterval(interval);
    }
  }, [clases]);

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
          <div className="row mb-4 align-items-center">
            <div className="col-12 text-center">
              <h1 className="display-5 fw-bold text-primary mb-2">
                ¡Hola, {nombre}!
              </h1>
              <p className="lead text-muted">
                Aquí tienes la información de tus clases asignadas
              </p>
            </div>
          </div>

          {/* Contador de Clase Activa o Próxima Clase */}
          {claseActiva ? (
            <div className="row mb-5 justify-content-center">
              <div className="col-md-8 col-lg-6">
                <div
                  className="card shadow-lg border-0 bg-success text-white"
                  style={{
                    borderRadius: '15px',
                  }}
                >
                  <div className="card-body text-center">
                    <h5 className="card-title mb-3">
                      <i className="bi bi-play-circle me-2"></i>Clase en Curso
                    </h5>
                    <h3 className="mb-2">
                      {claseActiva.clase.nombre_asignatura}
                    </h3>
                    <p className="mb-0">
                      {claseActiva.horario.dia.charAt(0).toUpperCase() + claseActiva.horario.dia.slice(1)} de {claseActiva.horario.hora_inicio} a {claseActiva.horario.hora_fin}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : proximaClase ? (
            <div className="row mb-5 justify-content-center">
              <div className="col-md-8 col-lg-6">
                <div
                  className="card shadow-lg border-0 bg-primary text-white"
                  style={{
                    borderRadius: '15px',
                  }}
                >
                  <div className="card-body text-center">
                    <h5 className="card-title mb-3">
                      <i className="bi bi-clock me-2"></i>Próxima Clase
                    </h5>
                    <h3 className="mb-2">
                      {proximaClase.clase.nombre_asignatura}
                    </h3>
                    <p className="fs-4 fw-bold mb-2">
                      {proximaClase.tiempoRestante}
                    </p>
                    <p className="mb-0">
                      {proximaClase.horario.dia.charAt(0).toUpperCase() + proximaClase.horario.dia.slice(1)} a las {proximaClase.horario.hora_inicio}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="row mb-5 justify-content-center">
              <div className="col-md-8 col-lg-6">
                <div className="alert alert-info text-center" role="alert">
                  No hay clases próximas programadas.
                </div>
              </div>
            </div>
          )}

          {/* Lista de Clases Asignadas */}
          {clases.length > 0 ? (
            <div className="row g-4">
              {clases.map((clase) => (
                <div key={clase.id_clase} className="col-md-6 col-lg-4">
                  <ClaseCard
                    nombreAsignatura={clase.nombre_asignatura}
                    horarios={clase.horarios}
                  />
                </div>
              ))}
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