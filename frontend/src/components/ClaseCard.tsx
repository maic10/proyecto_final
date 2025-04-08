// src/componente/ClaseCard.tsx
import React from 'react';

interface Horario {
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  id_aula: string;
  nombre_aula: string;
}

interface ClaseCardProps {
  nombreAsignatura: string;
  horarios: Horario[];
}

const ClaseCard: React.FC<ClaseCardProps> = ({ nombreAsignatura, horarios }) => {
  return (
    <div
      className="card shadow-lg border-0 h-100"
      style={{
        borderRadius: '15px',
        backgroundColor: '#f8f9fa',
      }}
    >
      <div
        className="card-header text-white text-center"
        style={{
          backgroundColor: '#007bff',
          borderTopLeftRadius: '15px',
          borderTopRightRadius: '15px',
        }}
      >
        <h4 className="card-title mb-0">
          {nombreAsignatura}
        </h4>
      </div>
      <div className="card-body">
        <h5 className="text-muted mb-3">
          <i className="bi bi-calendar3 me-2"></i>Horarios
        </h5>
        {horarios.length > 0 ? (
          <ul className="list-group list-group-flush">
            {horarios.map((h, idx) => (
              <li key={idx} className="list-group-item border-0 px-0 py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{h.dia.charAt(0).toUpperCase() + h.dia.slice(1)}:</strong>{' '}
                    {h.hora_inicio} - {h.hora_fin}
                    <br />
                    <small className="text-muted">Aula: {h.nombre_aula}</small>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Sin horarios definidos</p>
        )}
      </div>
    </div>
  );
};

export default ClaseCard;