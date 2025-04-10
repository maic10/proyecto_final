// src/components/EstudianteCard.tsx

interface Props {
  nombre: string;
  apellido: string;
  fotoBase64?: string; // Imagen codificada en base64
  fotoMimetype?: string; // Mimetype de la imagen (por ejemplo, "image/jpeg")
  idEstudiante?: string;
  onClick?: (buttonRef: HTMLButtonElement) => void;
}

function EstudianteCard({ nombre, apellido, fotoBase64, fotoMimetype, idEstudiante, onClick }: Props) {
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
        {fotoBase64 ? (
          <img
            src={`data:${fotoMimetype || 'image/jpeg'};base64,${fotoBase64}`}
            alt={`Foto de ${nombre}`}
            className="rounded-circle mb-3"
            style={{ width: '80px', height: '80px', objectFit: 'cover', border: '2px solid #007bff' }}
            onError={(e) => {
              // Si la imagen no se puede cargar, mostrar el placeholder
              e.currentTarget.src = 'https://via.placeholder.com/150?text=Sin+Foto';
            }}
          />
        ) : (
          <div
            className="rounded-circle bg-light d-flex align-items-center justify-content-center mb-3"
            style={{ width: '80px', height: '80px', border: '2px solid #007bff' }}
          >
            <i className="bi bi-person-fill text-muted" style={{ fontSize: '40px' }}></i>
          </div>
        )}
        <h6 className="card-title mb-1" style={{ color: '#333', fontWeight: '600' }}>
          {nombre} {apellido}
        </h6>
        {idEstudiante && (
          <small className="text-muted d-block" style={{ fontSize: '0.85rem' }}>
            ID: {idEstudiante}
          </small>
        )}
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