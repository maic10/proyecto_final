// src/components/admin/FormularioCrearEstudiante.tsx
import { useState, useEffect } from 'react';
import { obtenerAsignaturas, obtenerProfesoresPorAsignatura, obtenerClasesAdmin, obtenerProfesores } from '../../state/api';

interface Asignatura {
  id_asignatura: string;
  nombre: string;
}

interface Profesor {
  id_usuario: string;
  nombre: string;
  correo: string;
}

interface ClaseAsignada {
  idAsignatura: string;
  idProfesor: string | null;
}

interface FormularioCrearEstudianteProps {
  onSubmit: (nombre: string, apellido: string, idsClases: string[], fotos: File[]) => Promise<void>;
  onCancel: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const FormularioCrearEstudiante: React.FC<FormularioCrearEstudianteProps> = ({
  onSubmit,
  onCancel,
  error,
  setError,
}) => {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [todosProfesores, setTodosProfesores] = useState<Profesor[]>([]); 
  const [profesoresAsignatura, setProfesoresAsignatura] = useState<Profesor[]>([]); 
  const [nuevoEstudiante, setNuevoEstudiante] = useState({ nombre: '', apellido: '' });
  const [clasesAsignadas, setClasesAsignadas] = useState<ClaseAsignada[]>([]);
  const [nuevaClaseAsignada, setNuevaClaseAsignada] = useState({ idAsignatura: '', idProfesor: '' });
  const [cargandoAsignaturas, setCargandoAsignaturas] = useState(true);
  const [forceRender, setForceRender] = useState(0); 
  const [isProfesorDisabled, setIsProfesorDisabled] = useState(false); 
  const [mensajeConfirmacion, setMensajeConfirmacion] = useState<string | null>(null); 
  const [fotos, setFotos] = useState<File[]>([]); 

  // Hacer que los mensajes de error y confirmación desaparezcan después de un tiempo
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000); // 5 segundos
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  useEffect(() => {
    if (mensajeConfirmacion) {
      const timer = setTimeout(() => {
        setMensajeConfirmacion(null);
      }, 3000); // 3 segundos
      return () => clearTimeout(timer);
    }
  }, [mensajeConfirmacion]);

  // Cargar asignaturas y profesores al montar el componente
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      setCargandoAsignaturas(true);
      setError(null);
      try {
        const asignaturasData = await obtenerAsignaturas();
        console.log('Asignaturas cargadas:', asignaturasData);
        setAsignaturas(asignaturasData);
        if (asignaturasData.length === 0) {
          setError('No se encontraron asignaturas disponibles.');
        }

        const profesoresData = await obtenerProfesores();
        console.log('Todos los profesores cargados:', profesoresData);
        setTodosProfesores(profesoresData);
        if (profesoresData.length === 0) {
          setError('No se encontraron profesores disponibles.');
        }
      } catch (err: any) {
        console.error('Error al cargar asignaturas o profesores:', err);
        setError(err.response?.data?.error || 'Error al cargar las asignaturas o profesores. Intenta de nuevo más tarde.');
      } finally {
        setCargandoAsignaturas(false);
      }
    };

    cargarDatosIniciales();
  }, [setError]);

  // Cargar profesores cuando se selecciona una asignatura
  const handleAsignaturaChange = async (idAsignatura: string) => {
    // Cuando el usuario selecciona una asignatura, carga los profesores asociados a esa asignatura.
    // Si solo hay un profesor, lo selecciona automáticamente.    
    try {
      const profesoresData = await obtenerProfesoresPorAsignatura(idAsignatura);
      console.log('Profesores cargados para asignatura', idAsignatura, ':', profesoresData);
      setProfesoresAsignatura(profesoresData);

      // Si solo hay un profesor, pre-seleccionarlo y deshabilitar el selector
      if (profesoresData.length === 1) {
        setNuevaClaseAsignada({ idAsignatura, idProfesor: profesoresData[0].id_usuario });
        setIsProfesorDisabled(true);
      } else {
        setNuevaClaseAsignada({ idAsignatura, idProfesor: '' });
        setIsProfesorDisabled(false);
      }

      // Forzar re-renderizado
      setForceRender(prev => prev + 1);
    } catch (err: any) {
      console.error('Error al cargar profesores:', err);
      setError(err.response?.data?.error || 'Error al cargar los profesores. Intenta de nuevo más tarde.');
    }
  };

  // Añadir una asignatura y profesor al estudiante
  const handleAddClaseAsignada = () => {
    // Añade la asignatura y el profesor seleccionados a la lista de clases asignadas al estudiante.
    // Valida que no se repita la asignatura y que ambos campos estén seleccionados.
    if (!nuevaClaseAsignada.idAsignatura) {
      setError('Por favor, selecciona una asignatura.');
      return;
    }

    // Validar que se haya seleccionado un profesor
    if (!nuevaClaseAsignada.idProfesor) {
      setError('Por favor, selecciona un profesor.');
      return;
    }

    // Verificar si la asignatura ya ha sido añadida
    const asignaturaExistente = clasesAsignadas.find(clase => clase.idAsignatura === nuevaClaseAsignada.idAsignatura);
    if (asignaturaExistente) {
      setError('Esta asignatura ya ha sido añadida.');
      return;
    }

    console.log('Añadiendo clase:', nuevaClaseAsignada);
    setClasesAsignadas([...clasesAsignadas, { idAsignatura: nuevaClaseAsignada.idAsignatura, idProfesor: nuevaClaseAsignada.idProfesor }]);
    setNuevaClaseAsignada({ idAsignatura: '', idProfesor: '' });
    setProfesoresAsignatura([]); // Reiniciar profesores de la asignatura seleccionada
    setIsProfesorDisabled(false); // Restablecer el estado de deshabilitado
  };

  // Manejar la selección de fotos
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const nuevasFotos = Array.from(e.target.files);
      setFotos([...fotos, ...nuevasFotos]);
    }
  };

  // Eliminar una foto seleccionada
  const handleEliminarFoto = (index: number) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Obtener los ids_clases basados en las asignaturas y profesores seleccionados
      const idsClases: string[] = [];
      for (const clase of clasesAsignadas) {
        console.log('Buscando clases para:', { idAsignatura: clase.idAsignatura, idProfesor: clase.idProfesor });
        const clasesData = await obtenerClasesAdmin(clase.idAsignatura, clase.idProfesor);
        console.log('Clases encontradas:', clasesData);

        if (clasesData && clasesData.length > 0) {
          idsClases.push(...clasesData.map((c: any) => c.id_clase));
        } else {
          // Obtener el nombre de la asignatura y del profesor para el mensaje de error
          const asignatura = asignaturas.find(a => a.id_asignatura === clase.idAsignatura);
          const profesor = todosProfesores.find(p => p.id_usuario === clase.idProfesor);
          const nombreAsignatura = asignatura ? asignatura.nombre : clase.idAsignatura;
          const nombreProfesor = profesor ? profesor.nombre : clase.idProfesor;
          throw new Error(`No se encontraron clases para la asignatura ${nombreAsignatura} con el profesor ${nombreProfesor}.`);
        }
      }

      if (idsClases.length === 0) {
        setError('No se encontraron clases para las asignaturas y profesores seleccionados.');
        return;
      }

      // Enviar el estudiante y las fotos
      await onSubmit(nuevoEstudiante.nombre, nuevoEstudiante.apellido, idsClases, fotos);
      setMensajeConfirmacion('Usuario añadido'); 
      // Reiniciar el formulario
      setNuevoEstudiante({ nombre: '', apellido: '' });
      setClasesAsignadas([]);
      setNuevaClaseAsignada({ idAsignatura: '', idProfesor: '' });
      setProfesoresAsignatura([]);
      setFotos([]); 
      setIsProfesorDisabled(false);
    } catch (err: any) {
      console.error('Error al crear estudiante:', err);
      setError(err.message || 'Error al crear el estudiante. Intenta de nuevo más tarde.');
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-10 col-lg-8">
          <div className="card shadow-sm p-4">
            <h3 className="h5 mb-4 text-center">Crear Nuevo Estudiante</h3>
            {mensajeConfirmacion && (
              <div className="alert alert-success text-center" role="alert">
                {mensajeConfirmacion}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label htmlFor="nuevoNombre" className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-control"
                    id="nuevoNombre"
                    value={nuevoEstudiante.nombre}
                    onChange={(e) => setNuevoEstudiante({ ...nuevoEstudiante, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label htmlFor="nuevoApellido" className="form-label">Apellido</label>
                  <input
                    type="text"
                    className="form-control"
                    id="nuevoApellido"
                    value={nuevoEstudiante.apellido}
                    onChange={(e) => setNuevoEstudiante({ ...nuevoEstudiante, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Selección de asignaturas y profesores */}
              <div className="mb-3">
                <h4 className="h6 mb-3">Asignar Asignaturas</h4>
                {cargandoAsignaturas ? (
                  <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="mt-2">Cargando asignaturas...</p>
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-md-5">
                        <label htmlFor="nuevaAsignatura" className="form-label">Asignatura</label>
                        <select
                          className="form-select"
                          id="nuevaAsignatura"
                          value={nuevaClaseAsignada.idAsignatura}
                          onChange={(e) => {
                            console.log('Asignatura seleccionada:', e.target.value);
                            handleAsignaturaChange(e.target.value);
                          }}
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
                        <label htmlFor="nuevoProfesor" className="form-label">Profesor</label>
                        <select
                          className="form-select"
                          id="nuevoProfesor"
                          key={forceRender}
                          value={nuevaClaseAsignada.idProfesor}
                          onChange={(e) => {
                            console.log('Profesor seleccionado:', e.target.value);
                            setNuevaClaseAsignada({ ...nuevaClaseAsignada, idProfesor: e.target.value });
                          }}
                          disabled={isProfesorDisabled || !nuevaClaseAsignada.idAsignatura || profesoresAsignatura.length === 0}
                          style={{ color: 'black', backgroundColor: 'white' }}
                        >
                          {profesoresAsignatura.length > 1 && (
                            <option value="">Selecciona un profesor</option>
                          )}
                          {profesoresAsignatura.map((profesor) => (
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
                          onClick={(e) => {
                            e.preventDefault();
                            console.log('Botón Añadir clicado directamente');
                            handleAddClaseAsignada();
                          }}
                        >
                          Añadir
                        </button>
                      </div>
                    </div>

                    {/* Mostrar asignaturas asignadas */}
                    {clasesAsignadas.length > 0 && (
                      <div className="mb-3">
                        <h5 className="h6">Asignaturas Asignadas:</h5>
                        <ul className="list-group">
                          {clasesAsignadas.map((clase, index) => {
                            const asignatura = asignaturas.find(a => a.id_asignatura === clase.idAsignatura);
                            const profesor = clase.idProfesor ? todosProfesores.find(p => p.id_usuario === clase.idProfesor) : null;
                            return (
                              <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                                {asignatura?.nombre || clase.idAsignatura} {profesor ? `(Profesor: ${profesor.nombre})` : '(Cualquier profesor)'}
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setClasesAsignadas(clasesAsignadas.filter((_, i) => i !== index))}
                                >
                                  Eliminar
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Campo para cargar fotos */}
              <div className="mb-3">
                <h4 className="h6 mb-3">Añadir Fotos (Opcional)</h4>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  multiple
                  onChange={handleFotoChange}
                />
                {fotos.length > 0 && (
                  <div className="mt-3">
                    <h5 className="h6">Fotos Seleccionadas:</h5>
                    <div className="row g-3">
                      {fotos.map((foto, index) => (
                        <div key={index} className="col-md-3">
                          <div className="card">
                            <img
                              src={URL.createObjectURL(foto)}
                              alt={`Foto ${index + 1}`}
                              className="card-img-top"
                              style={{ height: '100px', objectFit: 'cover' }}
                            />
                            <div className="card-body text-center">
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleEliminarFoto(index)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 d-flex justify-content-end">
                <button type="submit" className="btn btn-primary me-2">
                  Crear Estudiante
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onCancel}
                >
                  Cancelar
                </button>
              </div>
              {error && (
                <div className="alert alert-danger mt-3" role="alert">
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormularioCrearEstudiante;