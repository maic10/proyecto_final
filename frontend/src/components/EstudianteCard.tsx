// src/components/EstudianteCard.tsx
interface Props {
  nombre: string;
  apellido: string;
  fotoUrl?: string;
  idEstudiante?: string; // Nuevo prop opcional para acciones futuras
  onClick?: () => void; // Para manejar clics en la tarjeta (opcional)
}

function EstudianteCard({ nombre, apellido, fotoUrl, idEstudiante, onClick }: Props) {
  return (
    <div
      className="card shadow-sm text-center h-100"
      style={{
        borderRadius: '10px',
        border: 'none',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
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
          src={fotoUrl || 'https://via.placeholder.com/150?text=Sin+Foto'}
          alt={`Foto de ${nombre}`}
          className="rounded-circle mb-3"
          style={{ width: '80px', height: '80px', objectFit: 'cover', border: '2px solid #007bff' }}
        />
        <h6 className="card-title mb-1" style={{ color: '#333', fontWeight: '600' }}>
          {nombre} {apellido}
        </h6>
        {idEstudiante && (
          <small className="text-muted d-block" style={{ fontSize: '0.85rem' }}>
            ID: {idEstudiante}
          </small>
        )}
      </div>
    </div>
  );
}

export default EstudianteCard;