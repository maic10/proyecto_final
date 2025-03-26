import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Agregamos useLocation
import { obtenerClases, obtenerEstudiantesPorClase } from '../state/api';
import { obtenerUsuario } from '../state/auth';
import EstudianteCard from '../components/EstudianteCard';

interface Estudiante {
  id_estudiante: string;
  nombre: string;
  apellido: string;
  urls_fotos: string[];
}

function PaginaEstudiantes() {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cargando, setCargando] = useState(true);
  const location = useLocation(); // Para verificar la ruta actual
  const navigate = useNavigate();

  const cargarEstudiantes = async () => {
    console.log('Cargando estudiantes...');
    const usuario = obtenerUsuario();
    if (!usuario) {
      setCargando(false);
      navigate('/'); // Redirigir si no está autenticado
      return;
    }

    try {
      // 1. Obtener clases del profesor
      const clases = await obtenerClases(usuario.id_usuario);
      if (clases.length > 0) {
        const idClase = clases[0].id_clase; // Toma la primera (o la única)
        // 2. Obtener estudiantes de esa clase
        const estudiantesData = await obtenerEstudiantesPorClase(idClase);
        setEstudiantes(estudiantesData);
      } else {
        setEstudiantes([]);
      }
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      setEstudiantes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Solo ejecuta la lógica si estamos en la ruta /estudiantes
    if (location.pathname === '/estudiantes') {
      cargarEstudiantes();
    }
  }, [location.pathname]); // Dependencia en la ruta

  return (
    <div className="container py-4">
      <h2 className="mb-4">Estudiantes de mi clase</h2>

      {cargando ? (
        <p>Cargando...</p>
      ) : estudiantes.length === 0 ? (
        <p>No hay estudiantes asignados a tu clase.</p>
      ) : (
        <div className="row">
          {estudiantes.map((est) => (
            <div key={est.id_estudiante} className="col-6 col-md-4 col-lg-3 mb-4">
              <EstudianteCard
                nombre={est.nombre}
                apellido={est.apellido}
                fotoUrl={est.urls_fotos?.[0]} // solo la primera foto
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaginaEstudiantes;