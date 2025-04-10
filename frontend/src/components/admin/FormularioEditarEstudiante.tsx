// src/components/admin/FormularioEditarEstudiante.tsx
import { useState, useEffect, useMemo } from 'react';
import { Estudiante, ClaseAsignada, Imagen } from '../../types/estudiantes';
import { obtenerAsignaturas, obtenerProfesoresPorAsignatura, subirImagenEstudiante, eliminarImagenEstudiante } from '../../state/api';

interface Asignatura {
  id_asignatura: string;
  nombre: string;
}

interface Profesor {
  id_usuario: string;
  nombre: string;
  correo: string;
}

interface ClaseAsignadaConNombre extends ClaseAsignada {
  nombreAsignatura: string;
  nombreProfesor: string | null;
}

interface FormularioEditarEstudianteProps {
  estudiante: Estudiante;
  clasesAsignadas: ClaseAsignada[];
  onSubmitInfoBasica: (nombre: string, apellido: string) => Promise<void>;
  onSubmitAsignaturas: (clasesAsignadas: ClaseAsignada[]) => Promise<void>;
  onDelete: (idEstudiante: string) => Promise<void>;
  onCancel: () => void;
  onReloadImages: () => Promise<void>;
  error: string | null;
  setError: (error: string | null) => void;
}

const FormularioEditarEstudiante: React.FC<FormularioEditarEstudianteProps> = ({
  estudiante,
  clasesAsignadas,
  onSubmitInfoBasica,
  onSubmitAsignaturas,
  onDelete,
  onCancel,
  onReloadImages,
  error,
  setError,
}) => {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [editandoDatos, setEditandoDatos] = useState({
    nombre: estudiante.nombre,
    apellido: estudiante.apellido,
    clasesAsignadas: clasesAsignadas.map(clase => ({
      ...clase,
      nombreAsignatura: '',
      nombreProfesor: null,
    })) as ClaseAsignadaConNombre[],
    nuevaClaseAsignada: { idAsignatura: '', idProfesor: '' } as ClaseAsignada,
    imagenes: estudiante.imagenes || [],
    nuevasImagenes: [] as File[],
    imagenesAEliminar: [] as string[],
  });
  const [cargandoAsignaturas, setCargandoAsignaturas] = useState(true);
  const [forceRender, setForceRender] = useState(0);
  const [isProfesorDisabled, setIsProfesorDisabled] = useState(false);
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null);

  // Hacer que los mensajes de error desaparezcan después de 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // Hacer que los mensajes de confirmación desaparezcan después de 5 segundos
  useEffect(() => {
    if (mensajeConfirmacion) {
      const timer = setTimeout(() => {
        setMensajeConfirmacion(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [mensajeConfirmacion]);

  // Cargar asignaturas al montar el componente
  useEffect(() => {
    const cargarAsignaturas = async () => {
      setCargandoAsignaturas(true);
      setError(null);
      try {
        const asignaturasData = await obtenerAsignaturas();
        setAsignaturas(asignaturasData);
        if (asignaturasData.length === 0) {
          setError('No se encontraron asignaturas disponibles.');
        }
      } catch (err: any) {
        console.error('Error al cargar asignaturas:', err);
        setError(err.response?.data?.error || 'Error al cargar las asignaturas. Intenta de nuevo más tarde.');
      } finally {
        setCargandoAsignaturas(false);
      }
    };

    cargarAsignaturas();
  }, [setError]);

  // Cargar nombres de asignaturas y profesores para las clases asignadas
  useEffect(() => {
    const cargarNombresClases = async () => {
      try {
        const clasesConNombres: ClaseAsignadaConNombre[] = [];
        // Crear un mapa de asignaturas para evitar buscar repetidamente
        const asignaturasMap = new Map<string, string>(
          asignaturas.map(a => [a.id_asignatura, a.nombre])
        );

        // Cargar profesores para todas las asignaturas de una vez
        const asignaturasUnicas = [...new Set(clasesAsignadas.map(clase => clase.idAsignatura))];
        const profesoresPorAsignatura: { [key: string]: Profesor[] } = {};
        for (const idAsignatura of asignaturasUnicas) {
          const profesoresData = await obtenerProfesoresPorAsignatura(idAsignatura);
          profesoresPorAsignatura[idAsignatura] = profesoresData;
        }

        // Asignar nombres a las clases asignadas
        for (const clase of clasesAsignadas) {
          const nombreAsignatura = asignaturasMap.get(clase.idAsignatura) || clase.idAsignatura;
          let nombreProfesor: string | null = null;
          if (clase.idProfesor) {
            const profesoresData = profesoresPorAsignatura[clase.idAsignatura] || [];
            const profesor = profesoresData.find(p => p.id_usuario === clase.idProfesor);
            nombreProfesor = profesor ? profesor.nombre : null;
          }
          clasesConNombres.push({
            ...clase,
            nombreAsignatura,
            nombreProfesor,
          });
        }

        setEditandoDatos(prev => ({
          ...prev,
          clasesAsignadas: clasesConNombres,
        }));
      } catch (err: any) {
        console.error('Error al cargar nombres de clases:', err);
        setError(err.response?.data?.error || 'Error al cargar los nombres de las clases. Intenta de nuevo más tarde.');
      }
    };

    if (asignaturas.length > 0 && clasesAsignadas.length > 0) {
      cargarNombresClases();
    }
  }, [asignaturas, clasesAsignadas, setError]);

  // Actualizar el estado local cuando cambian las props
  useEffect(() => {
    setEditandoDatos(prev => ({
      ...prev,
      nombre: estudiante.nombre,
      apellido: estudiante.apellido,
      imagenes: estudiante.imagenes || [],
    }));
  }, [estudiante]);

  // Cargar profesores cuando se selecciona una asignatura
  const handleAsignaturaChange = async (idAsignatura: string) => {
    if (!idAsignatura) {
      // Evitar llamar a la API si el idAsignatura es vacío
      setEditandoDatos(prev => ({
        ...prev,
        nuevaClaseAsignada: { idAsignatura: '', idProfesor: '' }
      }));
      setProfesores([]);
      setIsProfesorDisabled(false);
      return;
    }

    try {
      const profesoresData = await obtenerProfesoresPorAsignatura(idAsignatura);
      console.log('Profesores cargados:', profesoresData);
      setProfesores(profesoresData);

      if (profesoresData.length === 1) {
        setEditandoDatos(prev => ({
          ...prev,
          nuevaClaseAsignada: { idAsignatura, idProfesor: profesoresData[0].id_usuario }
        }));
        setIsProfesorDisabled(true);
      } else {
        setEditandoDatos(prev => ({
          ...prev,
          nuevaClaseAsignada: { idAsignatura, idProfesor: '' }
        }));
        setIsProfesorDisabled(false);
      }

      setForceRender(prev => prev + 1);
    } catch (err: any) {
      console.error('Error al cargar profesores:', err);
      setError(err.response?.data?.error || 'Error al cargar los profesores. Intenta de nuevo más tarde.');
    }
  };

  // Manejar la selección de una nueva imagen
  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const nuevasImagenes = Array.from(e.target.files);
      setEditandoDatos(prev => ({
        ...prev,
        nuevasImagenes: [...prev.nuevasImagenes, ...nuevasImagenes]
      }));
    }
  };

  // Marcar una imagen para eliminar
  const handleEliminarImagen = (fileId: string) => {
    setEditandoDatos(prev => ({
      ...prev,
      imagenesAEliminar: [...prev.imagenesAEliminar, fileId],
      imagenes: prev.imagenes.filter(img => img.file_id !== fileId)
    }));
  };

  // Añadir una asignatura y profesor al estudiante (sin guardar aún)
  const handleAddClaseAsignada = () => {
    if (!editandoDatos.nuevaClaseAsignada.idAsignatura) {
      setError('Por favor, selecciona una asignatura.');
      return;
    }

    if (!editandoDatos.nuevaClaseAsignada.idProfesor) {
      setError('Por favor, selecciona un profesor.');
      return;
    }

    const asignaturaExistente = editandoDatos.clasesAsignadas.find(
      clase => clase.idAsignatura === editandoDatos.nuevaClaseAsignada.idAsignatura
    );
    if (asignaturaExistente) {
      setError('Esta asignatura ya ha sido añadida.');
      return;
    }

    const asignaturaSeleccionada = asignaturas.find(
      a => a.id_asignatura === editandoDatos.nuevaClaseAsignada.idAsignatura
    );
    const profesorSeleccionado = profesores.find(
      p => p.id_usuario === editandoDatos.nuevaClaseAsignada.idProfesor
    );

    const nuevasClasesAsignadas = [
      ...editandoDatos.clasesAsignadas,
      {
        idAsignatura: editandoDatos.nuevaClaseAsignada.idAsignatura,
        idProfesor: editandoDatos.nuevaClaseAsignada.idProfesor,
        nombreAsignatura: asignaturaSeleccionada ? asignaturaSeleccionada.nombre : editandoDatos.nuevaClaseAsignada.idAsignatura,
        nombreProfesor: profesorSeleccionado ? profesorSeleccionado.nombre : null,
      }
    ];

    setEditandoDatos(prev => ({
      ...prev,
      clasesAsignadas: nuevasClasesAsignadas,
      nuevaClaseAsignada: { idAsignatura: '', idProfesor: '' }
    }));
    setProfesores([]);
    setIsProfesorDisabled(false);
  };

  // Eliminar una asignatura (sin guardar aún)
  const handleRemoveClaseAsignada = (index: number) => {
    const nuevasClasesAsignadas = editandoDatos.clasesAsignadas.filter((_, i) => i !== index);
    setEditandoDatos(prev => ({
      ...prev,
      clasesAsignadas: nuevasClasesAsignadas
    }));
  };

  // Manejar el envío del formulario de información básica (incluye fotos)
  const handleSubmitInfoBasica = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensajeConfirmacion(null);

    try {
      // Guardar información básica
      await onSubmitInfoBasica(editandoDatos.nombre, editandoDatos.apellido);

      // Subir nuevas imágenes
      for (const imagen of editandoDatos.nuevasImagenes) {
        await subirImagenEstudiante(estudiante.id_estudiante, imagen);
      }

      // Eliminar imágenes marcadas
      for (const fileId of editandoDatos.imagenesAEliminar) {
        await eliminarImagenEstudiante(estudiante.id_estudiante, fileId);
      }

      // Recargar las imágenes del estudiante
      await onReloadImages();

      // Limpiar las imágenes nuevas y las marcadas para eliminar
      setEditandoDatos(prev => ({
        ...prev,
        nuevasImagenes: [],
        imagenesAEliminar: []
      }));

      setMensajeConfirmacion('Cambios guardados correctamente');
    } catch (err: any) {
      console.error('Error al guardar información básica:', err);
      setError(err.message || 'Error al guardar la información básica. Intenta de nuevo más tarde.');
    }
  };

  // Manejar el envío de las asignaturas
  const handleSubmitAsignaturas = async () => {
    setError(null);
    setMensajeConfirmacion(null);

    try {
      // Solo pasar idAsignatura e idProfesor a onSubmitAsignaturas
      const clasesParaGuardar = editandoDatos.clasesAsignadas.map(clase => ({
        idAsignatura: clase.idAsignatura,
        idProfesor: clase.idProfesor,
      }));
      await onSubmitAsignaturas(clasesParaGuardar);
      setMensajeConfirmacion('Asignaturas actualizadas correctamente');
    } catch (err: any) {
      console.error('Error al actualizar asignaturas:', err);
      setError(err.message || 'Error al actualizar las asignaturas. Intenta de nuevo más tarde.');
    }
  };

  // Manejar la eliminación del estudiante
  const handleDelete = async () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este estudiante?')) {
      try {
        await onDelete(estudiante.id_estudiante);
      } catch (err: any) {
        console.error('Error al eliminar estudiante:', err);
        setError('Error al eliminar el estudiante. Intenta de nuevo más tarde.');
      }
    }
  };

  return (
    <div className="container py-5">
      <h2 className="mb-4">Editar Estudiante: {estudiante.nombre} {estudiante.apellido}</h2>

      {/* Bloque de información básica */}
      <div className="card shadow-sm p-4 mb-4">
        <h3 className="h5 mb-3">Información Básica</h3>
        <form onSubmit={handleSubmitInfoBasica}>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label htmlFor="editNombre" className="form-label">Nombre</label>
              <input
                type="text"
                className="form-control"
                id="editNombre"
                value={editandoDatos.nombre}
                onChange={(e) => setEditandoDatos({ ...editandoDatos, nombre: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="editApellido" className="form-label">Apellido</label>
              <input
                type="text"
                className="form-control"
                id="editApellido"
                value={editandoDatos.apellido}
                onChange={(e) => setEditandoDatos({ ...editandoDatos, apellido: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Sección de fotos */}
          <div className="mb-3">
            <h4 className="h6 mb-3">Fotos del Estudiante</h4>
            {editandoDatos.imagenes.length > 0 || editandoDatos.nuevasImagenes.length > 0 ? (
              <div className="row g-3">
                {editandoDatos.imagenes.map((imagen: Imagen) => (
                  <div key={imagen.file_id} className="col-md-3">
                    <div className="card">
                      <img
                        src={`data:${imagen.mimetype};base64,${imagen.data}`}
                        alt={imagen.filename}
                        className="card-img-top"
                        style={{ height: '150px', objectFit: 'cover' }}
                      />
                      <div className="card-body text-center">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleEliminarImagen(imagen.file_id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {editandoDatos.nuevasImagenes.map((imagen: File, index: number) => (
                  <div key={`nueva-${index}`} className="col-md-3">
                    <div className="card">
                      <img
                        src={URL.createObjectURL(imagen)}
                        alt={imagen.name}
                        className="card-img-top"
                        style={{ height: '150px', objectFit: 'cover' }}
                      />
                      <div className="card-body text-center">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setEditandoDatos(prev => ({
                            ...prev,
                            nuevasImagenes: prev.nuevasImagenes.filter((_, i) => i !== index)
                          }))}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No hay fotos asociadas.</p>
            )}
            <div className="mt-3">
              <label htmlFor="nuevaImagen" className="form-label">Añadir Nueva Foto</label>
              <input
                type="file"
                className="form-control"
                id="nuevaImagen"
                accept="image/*"
                multiple
                onChange={handleImagenChange}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary me-2">Guardar</button>
        </form>
      </div>

      {/* Bloque de asignaturas */}
      <div className="card shadow-sm p-4 mb-4">
        <h3 className="h5 mb-3">Asignaturas Asignadas</h3>
        {cargandoAsignaturas ? (
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-2">Cargando asignaturas...</p>
          </div>
        ) : (
          <>
            {editandoDatos.clasesAsignadas.length > 0 ? (
              <ul className="list-group mb-3">
                {editandoDatos.clasesAsignadas.map((clase, index) => (
                  <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                    {clase.nombreAsignatura} {clase.nombreProfesor ? `(Profesor: ${clase.nombreProfesor})` : '(Cualquier profesor)'}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveClaseAsignada(index)}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No hay asignaturas asignadas.</p>
            )}

            <div className="row g-3">
              <div className="col-md-5">
                <label htmlFor="editAsignatura" className="form-label">Nueva Asignatura</label>
                <select
                  className="form-select"
                  id="editAsignatura"
                  value={editandoDatos.nuevaClaseAsignada.idAsignatura}
                  onChange={(e) => handleAsignaturaChange(e.target.value)}
                >
                  <option value="">Selecciona una asignatura</option>
                  {asignaturas.map((asignatura) => (
                    <option key={asignatura.id_asignatura} value={asignatura.id_asignatura}>
                      {asignatura.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-5">
                <label htmlFor="editProfesor" className="form-label">Profesor</label>
                <select
                  className="form-select"
                  id="editProfesor"
                  key={forceRender}
                  value={editandoDatos.nuevaClaseAsignada.idProfesor}
                  onChange={(e) => setEditandoDatos(prev => ({
                    ...prev,
                    nuevaClaseAsignada: { ...prev.nuevaClaseAsignada, idProfesor: e.target.value }
                  }))}
                  disabled={isProfesorDisabled || !editandoDatos.nuevaClaseAsignada.idAsignatura || profesores.length === 0}
                  style={{ color: 'black', backgroundColor: 'white' }}
                >
                  {profesores.length > 1 && (
                    <option value="">Selecciona un profesor</option>
                  )}
                  {profesores.map((profesor) => (
                    <option key={profesor.id_usuario} value={profesor.id_usuario} style={{ color: 'black' }}>
                      {profesor.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-success w-100"
                  onClick={handleAddClaseAsignada}
                >
                  Añadir
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary mt-3"
              onClick={handleSubmitAsignaturas}
            >
              Guardar Asignaturas
            </button>
          </>
        )}
      </div>

      {/* Botones de acción */}
      <div className="mt-4">
        <button
          className="btn btn-danger me-2"
          onClick={handleDelete}
        >
          Eliminar Estudiante
        </button>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}
      {mensajeConfirmacion && <div className="alert alert-success mt-3">{mensajeConfirmacion}</div>}
    </div>
  );
};

export default FormularioEditarEstudiante;