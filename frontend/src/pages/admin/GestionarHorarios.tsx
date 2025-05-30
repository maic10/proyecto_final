import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clase, Profesor, Asignatura } from '../../types/horarios';
import { obtenerProfesores, obtenerAsignaturas, obtenerClasesPorProfesor, obtenerClasesPorAsignatura } from '../../state/api';


/**
 * Página de gestión de horarios para el administrador.
 * Permite filtrar clases por profesor o asignatura, ver la lista de clases resultante
 * y seleccionar una clase para editar sus horarios.
 * Carga los datos de profesores y asignaturas al iniciar, y muestra mensajes de carga o error según corresponda.
 */
const GestionarHorarios: React.FC = () => {
  const navigate = useNavigate();
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [filtroProfesor, setFiltroProfesor] = useState<string>('');
  const [filtroAsignatura, setFiltroAsignatura] = useState<string>('');
  const [filtroDebounced, setFiltroDebounced] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Cargar profesores y asignaturas al montar el componente
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      setCargando(true);
      setError(null);
      try {
        const profesoresData = await obtenerProfesores();
        const asignaturasData = await obtenerAsignaturas();
        setProfesores(profesoresData);
        setAsignaturas(asignaturasData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar profesores o asignaturas');
      } finally {
        setCargando(false);
      }
    };
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFiltroDebounced(filtroProfesor || filtroAsignatura);
    }, 300); // Retardo de 300ms

    return () => {
      clearTimeout(handler);
    };
  }, [filtroProfesor, filtroAsignatura]);

  // Filtrar clases cuando cambian los filtros 
  useEffect(() => {
    const cargarClases = async () => {
      setCargando(true);
      setError(null);
      try {
        let clasesData: Clase[] = [];
        if (filtroProfesor) {
          clasesData = await obtenerClasesPorProfesor(filtroProfesor);
        } else if (filtroAsignatura) {
          clasesData = await obtenerClasesPorAsignatura(filtroAsignatura);
        }
        setClases(clasesData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar las clases');
      } finally {
        setCargando(false);
      }
    };
    if (filtroProfesor || filtroAsignatura) {
      cargarClases();
    } else {
      setClases([]);
    }
  }, [filtroDebounced]);

  // Redirige a la página de edición de horarios con el ID de la clase seleccionada
  const handleSelectClase = (clase: Clase) => {
    navigate('/admin/horarios/editar', { state: { idClase: clase.id_clase } });
  };

  // Mapear IDs a nombres para mostrar en la lista
  const getNombreProfesor = (idUsuario: string) => {
    const profesor = profesores.find(p => p.id_usuario === idUsuario);
    return profesor ? profesor.nombre : idUsuario;
  };
  
  const getNombreAsignatura = (idAsignatura: string) => {
    const asignatura = asignaturas.find(a => a.id_asignatura === idAsignatura);
    return asignatura ? asignatura.nombre : idAsignatura;
  };

  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold text-primary mb-2">Gestión de Horarios</h1>

      {error && (
        <div className="alert alert-danger" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="card shadow-sm p-4 mb-4">
        <h3 className="h5 mb-3">Filtros</h3>
        <div className="row g-3">
          <div className="col-md-6">
            <label htmlFor="filtroProfesor" className="form-label">Filtrar por Profesor</label>
            <select
              id="filtroProfesor"
              className="form-select"
              value={filtroProfesor}
              onChange={(e) => {
                setFiltroProfesor(e.target.value);
                setFiltroAsignatura('');
              }}
              aria-label="Seleccionar profesor"
            >
              <option value="">Selecciona un profesor</option>
              {profesores.map(profesor => (
                <option key={profesor.id_usuario} value={profesor.id_usuario}>
                  {profesor.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label htmlFor="filtroAsignatura" className="form-label">Filtrar por Asignatura</label>
            <select
              id="filtroAsignatura"
              className="form-select"
              value={filtroAsignatura}
              onChange={(e) => {
                setFiltroAsignatura(e.target.value);
                setFiltroProfesor('');
              }}
              aria-label="Seleccionar asignatura"
            >
              <option value="">Selecciona una asignatura</option>
              {asignaturas.map(asignatura => (
                <option key={asignatura.id_asignatura} value={asignatura.id_asignatura}>
                  {asignatura.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de clases */}
      <div className="card shadow-sm p-4">
        {cargando ? (
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
            <p className="mt-2">Cargando clases...</p>
          </div>
        ) : clases.length === 0 ? (
          <div className="alert alert-info text-center" role="alert">
            No hay clases para mostrar. Selecciona un filtro.
          </div>
        ) : (
          <>
            <h3 className="h5 mb-3">Clases</h3>
            <ul className="list-group mb-3" role="listbox" aria-label="Lista de clases">
              {clases.map(clase => (
                <li
                  key={clase.id_clase}
                  className="list-group-item list-group-item-action"
                  onClick={() => handleSelectClase(clase)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectClase(clase)}
                  role="option"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                >
                  Asignatura: {getNombreAsignatura(clase.id_asignatura)} - Profesor: {getNombreProfesor(clase.id_usuario)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default GestionarHorarios;