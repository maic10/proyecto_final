import React from 'react';

interface ClaseSelectorCardProps {
  nombreAsignatura: string;
  onClick: () => void;
}

const ClaseSelectorCard: React.FC<ClaseSelectorCardProps> = ({ nombreAsignatura, onClick }) => {
  return (
    <div
      className="card shadow-sm border-0"
      style={{
        borderRadius: '10px',
        backgroundColor: '#fff',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'pointer',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
      }}
    >
      <div className="card-body d-flex align-items-center p-3">
        <i className="bi bi-book me-3 text-primary" style={{ fontSize: '1.5rem' }}></i>
        <h5 className="card-title mb-0" style={{ color: '#333', fontWeight: '500' }}>
          {nombreAsignatura}
        </h5>
      </div>
    </div>
  );
};

export default ClaseSelectorCard;