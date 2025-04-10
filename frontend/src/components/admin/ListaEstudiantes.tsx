// src/components/admin/ListaEstudiantes.tsx
import { useNavigate } from 'react-router-dom';
import { Estudiante } from '../../types/estudiantes';
import noPhoto from '../../assets/no-photo.avif';

interface ListaEstudiantesProps {
  estudiantes: Estudiante[];
}

const ListaEstudiantes: React.FC<ListaEstudiantesProps> = ({ estudiantes }) => {
  const navigate = useNavigate();

  return (
    <div className="list-group">
      {estudiantes.map((estudiante) => (
        <div
          key={estudiante.id_estudiante}
          className="list-group-item list-group-item-action d-flex align-items-center"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/admin/estudiantes/editar/${estudiante.id_estudiante}`)}
        >
          {estudiante.imagenes && estudiante.imagenes.length > 0 ? (
            <img
              src={`data:${estudiante.imagenes[0].mimetype};base64,${estudiante.imagenes[0].data}`}
              alt={`${estudiante.nombre}`}
              className="rounded-circle me-3"
              style={{ width: '40px', height: '40px', objectFit: 'cover' }}
              loading="lazy" // Carga diferida
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = noPhoto;
              }}
            />
          ) : (
            <img
              src={noPhoto}
              alt="Sin Foto"
              className="rounded-circle me-3"
              style={{ width: '40px', height: '40px', objectFit: 'cover' }}
              loading="lazy" // Carga diferida
            />
          )}
          <div>
            <h6 className="mb-0">{estudiante.nombre} {estudiante.apellido}</h6>
            <small className="text-muted">ID: {estudiante.id_estudiante}</small>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ListaEstudiantes;