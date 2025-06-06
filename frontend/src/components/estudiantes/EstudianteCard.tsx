import noPhoto from '../../assets/no-photo.avif'; 

interface Props {
  nombre: string;
  apellido: string;
  fotoBase64?: string; 
  fotoMimetype?: string; 
  idEstudiante?: string;
  onClick?: (buttonRef: HTMLButtonElement) => void;
}

/**
 * Componente visual para mostrar la información de un estudiante.
 * Muestra la foto (o una imagen por defecto), el nombre y apellido.
 * Si se proporciona la función onClick, muestra un botón para ver asistencias.
 */
function EstudianteCard({ nombre, apellido, fotoBase64, fotoMimetype, idEstudiante, onClick }: Props) {
  const getImagenSrc = (): string => {
    if (fotoBase64 && fotoMimetype) {
      return `data:${fotoMimetype};base64,${fotoBase64}`;
    }
    return noPhoto; 
  };

  return (
    <div
      className="card shadow-sm text-center h-100"
      style={{
        borderRadius: '10px',
        border: 'none',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
      }}
    >
      <div className="card-body p-3">
        <img
          src={getImagenSrc()}
          alt={fotoBase64 ? `${nombre}` : 'Sin Foto'}
          className="rounded-circle mb-3"
          style={{ width: '80px', height: '80px', objectFit: 'cover', border: '2px solid #007bff' }}
          onError={(e) => {
            e.currentTarget.onerror = null; 
            e.currentTarget.src = noPhoto; 
          }}
        />
        <h6 className="card-title mb-1" style={{ color: '#333', fontWeight: '600' }}>
          {nombre} {apellido}
        </h6>
        {onClick && (
          <button
            className="btn btn-primary mt-2"
            onClick={(e) => onClick(e.currentTarget)}
          >
            Ver Asistencias
          </button>
        )}
      </div>
    </div>
  );
}

export default EstudianteCard;