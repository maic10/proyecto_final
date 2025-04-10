// src/pages/admin/PaginaGestionarEstudiantes.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { Estudiante } from '../../types/estudiantes';
import { obtenerEstudiantes, obtenerEstudiantePorId } from '../../state/api';
import ListaEstudiantes from '../../components/admin/ListaEstudiantes';

const ITEMS_PER_PAGE = 5; // Número de estudiantes por página

const PaginaGestionarEstudiantes: React.FC = () => {
  const navigate = useNavigate();
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState<Estudiante[]>([]);
  const [estudiantesConImagenes, setEstudiantesConImagenes] = useState<{ [key: string]: Estudiante }>({}); // Estado para almacenar estudiantes con imágenes
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState<string>(''); // Estado para el buscador
  const [busquedaDebounced, setBusquedaDebounced] = useState<string>(''); // Estado para el valor debounced
  const [ordenAscendente, setOrdenAscendente] = useState<boolean>(true); // Estado para el ordenamiento
  const [paginaActual, setPaginaActual] = useState<number>(1); // Estado para la paginación
  const [filtroProfesor, setFiltroProfesor] = useState<string>(''); // Filtro por profesor
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>(''); // Filtro por asignatura

  // Cargar todos los estudiantes al montar el componente (sin imágenes)
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

        const estudiantesData = await obtenerEstudiantes(undefined, false); // No cargar imágenes inicialmente
        setEstudiantes(estudiantesData);
        setEstudiantesFiltrados(estudiantesData);
      } catch (err: any) {
        console.error('Error al cargar estudiantes:', err);
        setError('Error al cargar los estudiantes. Intenta de nuevo más tarde.');
      } finally {
        setCargando(false);
      }
    };

    cargarEstudiantesInicial();
  }, []);

  // Debounce para el filtro de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setBusquedaDebounced(busqueda);
    }, 300); // Retardo de 300ms

    return () => {
      clearTimeout(handler); // Limpiar el temporizador si busqueda cambia antes de 300ms
    };
  }, [busqueda]);

  // Filtrar estudiantes cuando cambie el valor debounced
  useEffect(() => {
    filtrarEstudiantes(busquedaDebounced, filtroProfesor, filtroAsignatura);
  }, [busquedaDebounced, filtroProfesor, filtroAsignatura]);

  // Manejar la búsqueda
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

  // Manejar el filtro por profesor o asignatura
  const filtrarEstudiantes = (busqueda: string, profesor: string, asignatura: string) => {
    let filtrados = [...estudiantes];

    // Filtrar por búsqueda
    if (busqueda) {
      filtrados = filtrados.filter(estudiante =>
        `${estudiante.nombre} ${estudiante.apellido}`.toLowerCase().includes(busqueda)
      );
    }

    // Filtrar por profesor (simulado, necesitarás ajustar según tu backend)
    if (profesor) {
      filtrados = filtrados.filter(estudiante =>
        estudiante.ids_clases.some(idClase => idClase.includes(profesor.toLowerCase()))
      );
    }

    // Filtrar por asignatura (simulado, necesitarás ajustar según tu backend)
    if (asignatura) {
      filtrados = filtrados.filter(estudiante =>
        estudiante.ids_clases.some(idClase => idClase.includes(asignatura.toLowerCase()))
      );
    }

    setEstudiantesFiltrados(filtrados);
    setPaginaActual(1); // Resetear la página al filtrar
  };

  // Manejar la paginación
  const totalPaginas = Math.ceil(estudiantesFiltrados.length / ITEMS_PER_PAGE);
  const estudiantesPaginados = estudiantesFiltrados.slice(
    (paginaActual - 1) * ITEMS_PER_PAGE,
    paginaActual * ITEMS_PER_PAGE
  );

  // Función para recargar las imágenes de los estudiantes visibles
  const cargarImagenesEstudiantes = async (estudiantes: Estudiante[]) => {
    try {
      const estudiantesIds = estudiantes.map(est => est.id_estudiante);
      const estudiantesSinImagenes = estudiantesIds.filter(id => !estudiantesConImagenes[id]);

      if (estudiantesSinImagenes.length === 0) return; // No hay estudiantes nuevos para cargar imágenes

      const estudiantesConImagenesNuevos = await Promise.all(
        estudiantesSinImagenes.map(async (id) => {
          const estudianteConImagenes = await obtenerEstudiantePorId(id);
          return estudianteConImagenes;
        })
      );

      // Actualizar el estado de estudiantesConImagenes
      setEstudiantesConImagenes(prev => {
        const nuevosEstudiantes = { ...prev };
        estudiantesConImagenesNuevos.forEach(est => {
          nuevosEstudiantes[est.id_estudiante] = est;
        });
        return nuevosEstudiantes;
      });
    } catch (err: any) {
      console.error('Error al cargar imágenes de estudiantes:', err);
      setError('Error al cargar las imágenes de los estudiantes. Intenta de nuevo más tarde.');
    }
  };

  // Cargar imágenes de los estudiantes visibles cuando cambie la página
  useEffect(() => {
    if (estudiantesPaginados.length > 0) {
      cargarImagenesEstudiantes(estudiantesPaginados);
    }
  }, [paginaActual, estudiantesFiltrados]); // Se ejecuta cuando cambia la página o los estudiantes filtrados

  // Combinar estudiantes paginados con sus imágenes
  const estudiantesPaginadosConImagenes = estudiantesPaginados.map(est => {
    return estudiantesConImagenes[est.id_estudiante] || est;
  });

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Gestión de Estudiantes</h2>
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
            <input
              type="text"
              className="form-control"
              placeholder="Filtrar por profesor..."
              value={filtroProfesor}
              onChange={(e) => {
                setFiltroProfesor(e.target.value);
                filtrarEstudiantes(busquedaDebounced, e.target.value, filtroAsignatura);
              }}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Filtrar por asignatura..."
              value={filtroAsignatura}
              onChange={(e) => {
                setFiltroAsignatura(e.target.value);
                filtrarEstudiantes(busquedaDebounced, filtroProfesor, e.target.value);
              }}
            />
          </div>
        </div>
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