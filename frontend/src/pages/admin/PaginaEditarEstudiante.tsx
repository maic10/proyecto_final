// src/pages/admin/PaginaEditarEstudiante.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FormularioEditarEstudiante from '../../components/admin/FormularioEditarEstudiante';
import { Estudiante, ClaseAsignada } from '../../types/estudiantes';
import { obtenerEstudiantePorId, actualizarEstudiante, eliminarEstudiante, obtenerClasesAdmin } from '../../state/api';

const PaginaEditarEstudiante: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [clasesAsignadas, setClasesAsignadas] = useState<ClaseAsignada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Cargar el estudiante y las clases asignadas al montar el componente
  useEffect(() => {
    const cargarEstudianteYClases = async () => {
      setCargando(true);
      setError(null);
      try {
        const estudianteData = await obtenerEstudiantePorId(id!);
        setEstudiante(estudianteData);

        const clases: ClaseAsignada[] = [];
        for (const idClase of estudianteData.ids_clases) {
          const clasesData = await obtenerClasesAdmin(undefined, undefined, idClase);
          const claseData = clasesData[0];
          if (claseData) {
            clases.push({
              idAsignatura: claseData.id_asignatura,
              idProfesor: claseData.id_usuario || null,
            });
          }
        }
        setClasesAsignadas(clases);
      } catch (err: any) {
        console.error('Error al cargar estudiante o clases:', err);
        setError('Error al cargar el estudiante o las clases. Intenta de nuevo más tarde.');
      } finally {
        setCargando(false);
      }
    };

    cargarEstudianteYClases();
  }, [id]); // Solo depende de id, no de estudiante ni clasesAsignadas

  // Función para recargar las imágenes del estudiante
  const handleReloadImages = async () => {
    try {
      const estudianteActualizado = await obtenerEstudiantePorId(id!);
      setEstudiante(estudianteActualizado);
    } catch (err: any) {
      console.error('Error al recargar las imágenes:', err);
      setError('Error al recargar las imágenes. Intenta de nuevo más tarde.');
    }
  };

  const handleSubmitInfoBasica = async (nombre: string, apellido: string) => {
    if (!estudiante) return;

    try {
      await actualizarEstudiante(estudiante.id_estudiante, nombre, apellido, estudiante.ids_clases);
      // Actualizar el estado localmente sin recargar el estudiante completo
      setEstudiante(prev => prev ? { ...prev, nombre, apellido } : null);
    } catch (err: any) {
      setError(err.message || 'Error al editar el estudiante. Intenta de nuevo más tarde.');
    }
  };

  const handleSubmitAsignaturas = async (clasesAsignadas: ClaseAsignada[]) => {
    if (!estudiante) return;

    try {
      const idsClases: string[] = [];
      for (const clase of clasesAsignadas) {
        const clasesData = await obtenerClasesAdmin(clase.idAsignatura, clase.idProfesor);
        if (clasesData && clasesData.length > 0) {
          idsClases.push(...clasesData.map((c: any) => c.id_clase));
        }
      }

      if (idsClases.length === 0) {
        throw new Error('No se encontraron clases para las asignaturas y profesores seleccionados.');
      }

      await actualizarEstudiante(estudiante.id_estudiante, estudiante.nombre, estudiante.apellido, idsClases);
      // Actualizar el estado localmente sin recargar el estudiante completo
      setClasesAsignadas(clasesAsignadas);
      setEstudiante(prev => prev ? { ...prev, ids_clases: idsClases } : null);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar las asignaturas. Intenta de nuevo más tarde.');
    }
  };

  const handleDelete = async (idEstudiante: string) => {
    try {
      await eliminarEstudiante(idEstudiante);
      navigate('/admin/estudiantes');
    } catch (err: any) {
      setError('Error al eliminar el estudiante. Intenta de nuevo más tarde.');
    }
  };

  if (cargando) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p className="mt-2">Cargando estudiante...</p>
      </div>
    );
  }

  if (!estudiante) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error || 'Estudiante no encontrado.'}
        </div>
      </div>
    );
  }

  return (
    <FormularioEditarEstudiante
      estudiante={estudiante}
      clasesAsignadas={clasesAsignadas}
      onSubmitInfoBasica={handleSubmitInfoBasica}
      onSubmitAsignaturas={handleSubmitAsignaturas}
      onDelete={handleDelete}
      onCancel={() => navigate('/admin/estudiantes')}
      onReloadImages={handleReloadImages}
      error={error}
      setError={setError}
    />
  );
};

export default PaginaEditarEstudiante;