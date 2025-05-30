import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Horario, Clase, Aula, Asignatura, Profesor } from '../../types/horarios';
import { obtenerClasePorId, actualizarHorarios, obtenerClasesPorProfesor, obtenerAulas, obtenerAsignaturas, obtenerProfesores } from '../../state/api';
import EditarHorarios from '../../components/admin/EditarHorarios';

/**
 * Página para editar los horarios de una clase.
 * Carga la información de la clase, aulas, asignaturas y profesores.
 * Permite editar los horarios, validando superposiciones y mostrando mensajes de éxito o error.
 */
const PaginaEditarHorarios: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { idClase } = location.state || {}; 

  const [clase, setClase] = useState<Clase | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [nombreAsignatura, setNombreAsignatura] = useState<string>('Cargando...');
  const [nombreProfesor, setNombreProfesor] = useState<string>('Cargando...');

  // Cargar la clase, aulas, asignaturas y profesores al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      setError(null);

      if (!idClase) {
        setError('ID de clase no proporcionado');
        setCargando(false);
        navigate('/admin/horarios');
        return;
      }

      try {
        // Cargar la clase
        const claseData = await obtenerClasePorId(idClase);
        setClase(claseData);
        setHorarios(claseData.horarios);

        // Cargar aulas
        const aulasData = await obtenerAulas();
        setAulas(aulasData);

        // Cargar asignaturas y profesores para mapear los nombres
        const asignaturasData = await obtenerAsignaturas();
        setAsignaturas(asignaturasData);

        const profesoresData = await obtenerProfesores();
        setProfesores(profesoresData);

        // Actualizar nombres después de cargar asignaturas y profesores
        const asignatura = asignaturasData.find(a => a.id_asignatura === claseData.id_asignatura);
        const profesor = profesoresData.find(p => p.id_usuario === claseData.id_usuario);

        if (!asignatura) {
          setError(`Asignatura con ID ${claseData.id_asignatura} no encontrada`);
        } else {
          setNombreAsignatura(asignatura.nombre);
        }

        if (!profesor) {
          setError(`Profesor con ID ${claseData.id_usuario} no encontrado`);
        } else {
          setNombreProfesor(profesor.nombre);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar la clase, aulas, asignaturas o profesores');
        console.error('Error al cargar datos:', err);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [idClase, navigate]);

  // Limpia el mensaje de éxito después de 5 segundos
  useEffect(() => {
    if (mensajeExito) {
      const timer = setTimeout(() => {
        setMensajeExito(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [mensajeExito]);

  // Limpia el mensaje de éxito después de 3 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * Guarda los horarios editados de la clase.
   * Actualiza los horarios en el backend y muestra mensaje de éxito o error.
   */
  const handleSave = async (nuevosHorarios: Horario[]) => {
    if (!idClase) return;

    setCargando(true);
    setError(null);
    setMensajeExito(null);
    try {
      await actualizarHorarios(idClase, nuevosHorarios);
      const claseActualizada = await obtenerClasePorId(idClase);
      setHorarios(claseActualizada.horarios);
      setMensajeExito('Horarios actualizados correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar los horarios');
    } finally {
      setCargando(false);
    }
  };

  /**
   * Cancela la edición y vuelve a la lista de horarios.
   */
  const handleCancel = () => {
    navigate('/admin/horarios');
  };

  /**
   * Valida si el nuevo horario se superpone con otros horarios del mismo profesor en otras clases.
   * Devuelve un mensaje de error si hay superposición.
   */
  const validarSuperposicion = async (nuevoHorario: Horario) => {
    try {
      const clasesProfesor = await obtenerClasesPorProfesor(clase!.id_usuario);
      const horariosProfesor = clasesProfesor
        .filter(c => c.id_clase !== clase!.id_clase)
        .flatMap(c => c.horarios);

      for (const horarioExistente of horariosProfesor) {
        if (nuevoHorario.dia === horarioExistente.dia) {
          if (
            (nuevoHorario.hora_inicio < horarioExistente.hora_fin) &&
            (nuevoHorario.hora_fin > horarioExistente.hora_inicio)
          ) {
            return `El horario se superpone con otra clase del profesor: ${nombresDias[horarioExistente.dia as keyof typeof nombresDias]} ${horarioExistente.hora_inicio}-${horarioExistente.hora_fin}`;
          }
        }
      }
      return null;
    } catch (err: any) {
      return 'Error al validar superposición con otras clases del profesor';
    }
  };

  // Días válidos 
  const diasValidos = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes'];
  
  const nombresDias = {
    lunes: 'Lunes',
    martes: 'Martes',
    'miércoles': 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes'
  };

  if (cargando) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando clase...</p>
      </div>
    );
  }

  if (!clase) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error || 'Clase no encontrada.'}
        </div>
      </div>
    );
  }

  return (
    <EditarHorarios
      horarios={horarios}
      setHorarios={setHorarios}
      aulas={aulas}
      error={error}
      setError={setError}
      cargando={cargando}
      setCargando={setCargando}
      diasValidos={diasValidos}
      nombresDias={nombresDias}
      validarSuperposicion={validarSuperposicion}
      onSave={handleSave}
      onCancel={handleCancel}
      mensajeExito={mensajeExito}
      nombreAsignatura={nombreAsignatura}
      nombreProfesor={nombreProfesor}
    />
  );
};

export default PaginaEditarHorarios;