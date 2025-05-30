import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormularioCrearEstudiante from '../../components/admin/FormularioCrearEstudiante';
import { crearEstudiante, subirImagenEstudiante } from '../../state/api';

/**
 * Página para crear un nuevo estudiante.
 * Gestiona el formulario, la creación del estudiante y la subida de fotos.
 */
const PaginaCrearEstudiante: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (nombre: string, apellido: string, idsClases: string[], fotos: File[]) => {
    try {
      // Crear el estudiante
      const response = await crearEstudiante(nombre, apellido, idsClases);
      const idEstudiante = response.id_estudiante; 

      // Subir las fotos si existen
      if (fotos.length > 0) {
        for (const foto of fotos) {
          await subirImagenEstudiante(idEstudiante, foto);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el estudiante o subir las fotos. Intenta de nuevo más tarde.');
    }
  };

  return (
    <FormularioCrearEstudiante
      onSubmit={handleSubmit}
      onCancel={() => navigate('/admin/estudiantes')}
      error={error}
      setError={setError}
    />
  );
};

export default PaginaCrearEstudiante;