// src/pages/admin/PaginaEditarHorarios.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Horario, Clase, Aula, Asignatura, Profesor } from '../../types/horarios';
import { obtenerClasePorId, actualizarHorarios, obtenerClasesPorProfesor, obtenerAulas, obtenerAsignaturas, obtenerProfesores } from '../../state/api';
import EditarHorarios from '../../components/admin/EditarHorarios';

const PaginaEditarHorarios: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

      if (!id) {
        setError('ID de clase no proporcionado');
        setCargando(false);
        navigate('/admin/horarios');
        return;
      }

      try {
        // Cargar la clase
        const claseData = await obtenerClasePorId(id);
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
  }, [id, navigate]);

  // Temporizador para limpiar mensajes de éxito y error
  useEffect(() => {
    if (mensajeExito) {
      const timer = setTimeout(() => {
        setMensajeExito(null);
      }, 5000); // 5 segundos
      return () => clearTimeout(timer);
    }
  }, [mensajeExito]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000); // 5 segundos
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSave = async (nuevosHorarios: Horario[]) => {
    if (!id) return;

    setCargando(true);
    setError(null);
    setMensajeExito(null);
    try {
      await actualizarHorarios(id, nuevosHorarios);
      // Actualizar los horarios en el estado para reflejar los cambios
      const claseActualizada = await obtenerClasePorId(id);
      setHorarios(claseActualizada.horarios);
      setMensajeExito('Horarios actualizados correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar los horarios');
    } finally {
      setCargando(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/horarios');
  };

  // Validar superposición con otros horarios del mismo profesor (en otras clases)
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

  // Días válidos en español
  // Quitar sabado y domingo en prod 
  const diasValidos = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  // Mapeo de días en español a nombres para mostrar
  // Quitar sabado y domingo en prod 
  const nombresDias = {
    lunes: 'Lunes',
    martes: 'Martes',
    'miércoles': 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    'sábado': 'Sábado',
    domingo: 'Domingo',
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