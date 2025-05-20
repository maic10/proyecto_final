import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { Estudiante } from '../../types/estudiantes';
import { Asignatura, Profesor } from '../../types/horarios';
import { obtenerEstudiantes, obtenerEstudiantePorId, obtenerAsignaturas, obtenerProfesores, filtrarEstudiantes as fetchEstudiantesFiltrados } from '../../state/api';
import ListaEstudiantes from '../../components/admin/ListaEstudiantes';

const ITEMS_PER_PAGE = 5; // Número de estudiantes por página

/**
 * Página para gestionar estudiantes: búsqueda, filtros, orden, paginación y visualización.
 */
const PaginaGestionarEstudiantes: React.FC = () => {
  const navigate = useNavigate();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState<Estudiante[]>([]);
  const [estudiantesConFiltroAvanzado, setEstudiantesConFiltroAvanzado] = useState<Estudiante[]>([]);
  const [estudiantesConImagenes, setEstudiantesConImagenes] = useState<{ [key: string]: Estudiante }>({});
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [asignaturasPorProfesor, setAsignaturasPorProfesor] = useState<{ [key: string]: Asignatura[] }>({});
  const [profesoresPorAsignatura, setProfesoresPorAsignatura] = useState<{ [key: string]: Profesor[] }>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState<string>(''); 
  const [busquedaDebounced, setBusquedaDebounced] = useState<string>(''); 
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(true); 
  const [paginaActual, setPaginaActual] = useState<number>(1); 
  const [filtroProfesor, setFiltroProfesor] = useState<string>(''); 
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>(''); 
  const [usarFiltrosAvanzados, setUsarFiltrosAvanzados] = useState<boolean>(false); 
  const solicitudesImagenes = useRef<Map<string, Promise<Estudiante>>>(new Map());

  // Cargar estudiantes al montar el componente 
  useEffect(() => {
    const cargarEstudiantesInicial = async () => {
      setCargando(true);
      setError(null);
      try {
        const usuario = obtenerUsuario();
        if (!usuario || usuario.rol !== 'admin') {
          setError('No tienes permisos para acceder a esta funcionalidad.');
          setCargando(false);
          return;
        }

        // Cargar estudiantes (sin imágenes inicialmente)
        const estudiantesData = await obtenerEstudiantes(undefined, false);
        console.log('Estudiantes iniciales:', estudiantesData);
        setEstudiantes(estudiantesData);
        setEstudiantesConFiltroAvanzado(estudiantesData);
        setEstudiantesFiltrados(estudiantesData);
      } catch (err: any) {
        console.error('Error al cargar estudiantes:', err);
        setError('Error al cargar los estudiantes. Intenta de nuevo más tarde.');
        setEstudiantesFiltrados([]); // Asegurar que sea un arreglo vacío en caso de error
        setEstudiantesConFiltroAvanzado([]);
      } finally {
        setCargando(false);
      }
    };

    cargarEstudiantesInicial();
  }, []);

  // Carga asignaturas y profesores cuando se activan los filtros avanzados
  useEffect(() => {
    if (!usarFiltrosAvanzados) {
      // Si los filtros avanzados no están habilitados, no cargar datos adicionales
      setAsignaturas([]);
      setProfesores([]);
      setFiltroProfesor('');
      setFiltroAsignatura('');
      setEstudiantesConFiltroAvanzado(estudiantes); 
      return;
    }

    const cargarDatosFiltros = async () => {
      setCargando(true);
      setError(null);
      try {
        // Cargar asignaturas
        const asignaturasData = await obtenerAsignaturas();
        setAsignaturas(asignaturasData);

        // Cargar profesores
        const profesoresData = await obtenerProfesores();
        setProfesores(profesoresData);

        // Cargar asignaturas por profesor y profesores por asignatura
        const asignaturasPorProfesorMap: { [key: string]: Asignatura[] } = {};
        const profesoresPorAsignaturaMap: { [key: string]: Profesor[] } = {};
        for (const asignatura of asignaturasData) {
          profesoresPorAsignaturaMap[asignatura.id_asignatura] = [];
        }

        for (const profesor of profesoresData) {
          const estudiantesProfesor = await fetchEstudiantesFiltrados(profesor.id_usuario, undefined, false);
          console.log(`Estudiantes del profesor ${profesor.id_usuario}:`, estudiantesProfesor);

          if (!Array.isArray(estudiantesProfesor) || estudiantesProfesor.length === 0) {
            asignaturasPorProfesorMap[profesor.id_usuario] = [];
            continue;
          }
          const clasesProfesor = estudiantesProfesor
            .filter(est => Array.isArray(est.ids_clases)) 
            .flatMap((est: Estudiante) => est.ids_clases);
          console.log(`Clases del profesor ${profesor.id_usuario}:`, clasesProfesor);
          const clasesUnicas = [...new Set(clasesProfesor)];
          const asignaturasProfesor = asignaturasData.filter((asignatura: Asignatura) =>
            clasesUnicas.some((idClase: string) => idClase?.includes(asignatura.id_asignatura))
          );
          asignaturasPorProfesorMap[profesor.id_usuario] = [...new Set(asignaturasProfesor)];

          // Asignar profesores a las asignaturas correspondientes
          asignaturasProfesor.forEach((asignatura: Asignatura) => {
            if (!profesoresPorAsignaturaMap[asignatura.id_asignatura].some(p => p.id_usuario === profesor.id_usuario)) {
              profesoresPorAsignaturaMap[asignatura.id_asignatura].push(profesor);
            }
          });
        }
        setAsignaturasPorProfesor(asignaturasPorProfesorMap);
        setProfesoresPorAsignatura(profesoresPorAsignaturaMap);

        // Aplicar el filtrado inicial si ya hay valores seleccionados
        await filtrarEstudiantes(filtroProfesor, filtroAsignatura);
      } catch (err: any) {
        console.error('Error al cargar datos de filtros:', err);
        setError('Error al cargar asignaturas o profesores. Intenta de nuevo más tarde.');
        setEstudiantesFiltrados([]); 
        setEstudiantesConFiltroAvanzado([]);
      } finally {
        setCargando(false);
      }
    };

    cargarDatosFiltros();
  }, [usarFiltrosAvanzados, filtroProfesor, filtroAsignatura, estudiantes]);

  // Aplica un debounce al filtro de búsqueda para evitar búsquedas excesivas
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 300); // Retardo de 300ms

    return () => {
      clearTimeout(handler); // Limpiar el temporizador si busqueda cambia antes de 300ms
    };
  }, [busqueda]);

  // Filtra estudiantes por nombre/apellido cuando cambia el término de búsqueda
  useEffect(() => {
    let filtrados = [...estudiantesConFiltroAvanzado];

    if (busquedaDebounced) {
      filtrados = filtrados.filter(estudiante =>
        `${estudiante.nombre} ${estudiante.apellido}`.toLowerCase().includes(busquedaDebounced)
      );
    }

    setEstudiantesFiltrados(filtrados);
    setPaginaActual(1); // Resetear la página al filtrar
  }, [busquedaDebounced, estudiantesConFiltroAvanzado]);

  // Ordena la lista de estudiantes por nombre
  const handleBusqueda = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.toLowerCase();
    setBusqueda(valor);
  };

  // Manejar el ordenamiento
  const handleOrdenar = () => {
    const ordenados = [...estudiantesFiltrados].sort((a, b) => {
      const nombreA = `${a.nombre} ${a.apellido}`.toLowerCase();
      const nombreB = `${b.nombre} ${b.apellido}`.toLowerCase();
      return ordenAscendente ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    });
    setEstudiantesFiltrados(ordenados);
    setOrdenAscendente(!ordenAscendente);
  };

  // Filtra estudiantes usando la API cuando se usan filtros avanzados
  const filtrarEstudiantes = async (profesor: string, asignatura: string) => {
    let filtrados: Estudiante[] = [...estudiantes];

    // Si los filtros avanzados están habilitados, usar la API para filtrar
    if (usarFiltrosAvanzados && (profesor || asignatura)) {
      try {
        console.log('Filtrando estudiantes con:', { profesor, asignatura });
        filtrados = await fetchEstudiantesFiltrados(profesor || undefined, asignatura || undefined, false);
        console.log('Estudiantes filtrados:', filtrados);
      } catch (err: any) {
        console.error('Error al filtrar estudiantes:', err);
        setError('Error al aplicar los filtros. Intenta de nuevo más tarde.');
        filtrados = []; 
      }
    }

    setEstudiantesConFiltroAvanzado(filtrados);
  };

  // Manejar el cambio en el selector de profesor
  const handleProfesorChange = (idProfesor: string) => {
    setFiltroProfesor(idProfesor);
    setFiltroAsignatura(''); // Reiniciar el filtro de asignatura al cambiar el profesor
  };

  // Manejar el cambio en el selector de asignatura
  const handleAsignaturaChange = (idAsignatura: string) => {
    setFiltroAsignatura(idAsignatura);
    setFiltroProfesor(''); // Reiniciar el filtro de profesor al cambiar la asignatura
  };

  // Manejar la paginación
  const totalPaginas = Math.ceil((estudiantesFiltrados || []).length / ITEMS_PER_PAGE);
  const estudiantesPaginados = (estudiantesFiltrados || []).slice(
    (paginaActual - 1) * ITEMS_PER_PAGE,
    paginaActual * ITEMS_PER_PAGE
  );

  // Carga las imágenes de los estudiantes visibles en la página actual
  const cargarImagenesEstudiantes = async (estudiantes: Estudiante[]) => {
    try {
      const estudiantesIds = estudiantes.map(est => est.id_estudiante);
      const estudiantesSinImagenes = estudiantesIds.filter(id => !estudiantesConImagenes[id]);

      if (estudiantesSinImagenes.length === 0) return; 

      const promesasImagenes: Promise<Estudiante>[] = [];
      estudiantesSinImagenes.forEach(id => {
        // Verificar si ya hay una solicitud en curso para este estudiante
        if (solicitudesImagenes.current.has(id)) {
          promesasImagenes.push(solicitudesImagenes.current.get(id)!);
        } else {
          const promesa = obtenerEstudiantePorId(id);
          solicitudesImagenes.current.set(id, promesa);
          promesasImagenes.push(promesa);
        }
      });

      const estudiantesConImagenesNuevos = await Promise.all(promesasImagenes);

      // Actualizar el estado de estudiantesConImagenes
      setEstudiantesConImagenes(prev => {
        const nuevosEstudiantes = { ...prev };
        estudiantesConImagenesNuevos.forEach(est => {
          nuevosEstudiantes[est.id_estudiante] = est;

          solicitudesImagenes.current.delete(est.id_estudiante);
        });
        return nuevosEstudiantes;
      });
    } catch (err: any) {
      setError('Error al cargar las imágenes de los estudiantes. Intenta de nuevo más tarde.');
    }
  };

  // Cargar imágenes de los estudiantes visibles cuando cambie la página
  useEffect(() => {
    if (estudiantesPaginados.length > 0) {
      cargarImagenesEstudiantes(estudiantesPaginados);
    }
  }, [paginaActual, estudiantesPaginados]);

  // Combinar estudiantes paginados con sus imágenes
  const estudiantesPaginadosConImagenes = estudiantesPaginados.map(est => {
    return estudiantesConImagenes[est.id_estudiante] || est;
  });

  // Obtener las asignaturas disponibles según el profesor seleccionado
  const asignaturasDisponibles = filtroProfesor ? asignaturasPorProfesor[filtroProfesor] || [] : asignaturas;

  // Obtener los profesores disponibles según la asignatura seleccionada
  const profesoresDisponibles = filtroAsignatura ? profesoresPorAsignatura[filtroAsignatura] || [] : profesores;

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="display-6 fw-bold text-primary mb-2">Gestión de Estudiantes</h1>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/admin/estudiantes/crear')}
        >
          Añadir Nuevo Estudiante
        </button>
      </div>

      {/* Mensajes de error */}
      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}

      {/* Filtros y buscador */}
      <div className="card shadow-sm p-4 mb-4">
        <h3 className="h5 mb-3">Filtros</h3>
        <div className="row g-3">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nombre o apellido..."
              value={busqueda}
              onChange={handleBusqueda}
            />
          </div>
          <div className="col-md-4">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="usarFiltrosAvanzados"
                checked={usarFiltrosAvanzados}
                onChange={(e) => setUsarFiltrosAvanzados(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="usarFiltrosAvanzados">
                Habilitar filtros por profesor y asignatura
              </label>
            </div>
          </div>
          <div className="col-md-4">
            {/* Espacio vacío para mantener el diseño */}
          </div>
        </div>
        {usarFiltrosAvanzados && (
          <div className="row g-3 mt-2">
            <div className="col-md-4">
              <select
                className="form-select"
                value={filtroProfesor}
                onChange={(e) => handleProfesorChange(e.target.value)}
                disabled={cargando || (filtroAsignatura && profesoresDisponibles.length === 0)}
              >
                <option value="">Seleccionar profesor</option>
                {profesoresDisponibles.map((profesor) => (
                  <option key={profesor.id_usuario} value={profesor.id_usuario}>
                    {profesor.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={filtroAsignatura}
                onChange={(e) => handleAsignaturaChange(e.target.value)}
                disabled={cargando || (filtroProfesor && asignaturasDisponibles.length === 0)}
              >
                <option value="">Seleccionar asignatura</option>
                {asignaturasDisponibles.map((asignatura) => (
                  <option key={asignatura.id_asignatura} value={asignatura.id_asignatura}>
                    {asignatura.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Lista de estudiantes */}
      <div className="card shadow-sm p-4">
        {cargando ? (
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-2">Cargando estudiantes...</p>
          </div>
        ) : estudiantesFiltrados.length === 0 ? (
          <div className="alert alert-info text-center" role="alert">
            No hay estudiantes registrados.
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h5 mb-0">Lista de Estudiantes</h3>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={handleOrdenar}
              >
                Ordenar por nombre {ordenAscendente ? '↓' : '↑'}
              </button>
            </div>
            <ListaEstudiantes estudiantes={estudiantesPaginadosConImagenes} />

            {/* Paginación */}
            {totalPaginas > 1 && (
              <nav className="mt-4">
                <ul className="pagination justify-content-center">
                  <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPaginaActual(paginaActual - 1)}
                      disabled={paginaActual === 1}
                    >
                      Anterior
                    </button>
                  </li>
                  {[...Array(totalPaginas)].map((_, index) => (
                    <li key={index} className={`page-item ${paginaActual === index + 1 ? 'active' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPaginaActual(index + 1)}
                      >
                        {index + 1}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setPaginaActual(paginaActual + 1)}
                      disabled={paginaActual === totalPaginas}
                    >
                      Siguiente
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PaginaGestionarEstudiantes;