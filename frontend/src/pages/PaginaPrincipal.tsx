import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerPerfil, obtenerClases } from '../state/api';
import { obtenerUsuario } from '../state/auth';

interface Clase {
  id_clase: string;
  nombre: string;
  horarios: { dia: string; hora_inicio: string; hora_fin: string; id_aula: string }[];
}

function PaginaPrincipal() {
  const [nombre, setNombre] = useState('');
  const [clases, setClases] = useState<Clase[]>([]);
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
      setClases(clasesData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      navigate('/');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (location.pathname === '/inicio') {
      cargarDatos();
    }
  }, [location.pathname]);

  return (
    <div className="container py-4">
      {cargando ? (
        <p>Cargando...</p>
      ) : (
        <>
          <h2 className="mb-3">Bienvenido, <strong>{nombre}</strong></h2>
          <h4 className="mb-4">Clases asignadas</h4>

          {clases.length === 0 ? (
            <div className="alert alert-info">No tienes clases asignadas actualmente.</div>
          ) : (
            <div className="row">
              {clases.map((clase) => (
                <div key={clase.id_clase} className="col-md-6 col-lg-4 mb-4">
                  <div className="card shadow-sm h-100">
                    <div className="card-body">
                      <h5 className="card-title">{clase.nombre}</h5>
                      <p><strong>ID:</strong> {clase.id_clase}</p>
                      <p><strong>Horarios:</strong></p>
                      <ul className="mb-0">
                        {clase.horarios.map((h, idx) => (
                          <li key={idx}>
                            {h.dia}: {h.hora_inicio} - {h.hora_fin} <br />
                            <small className="text-muted">Aula: {h.id_aula}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PaginaPrincipal;