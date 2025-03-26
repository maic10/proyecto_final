//import React from 'react';

interface Props {
  nombre: string;
  apellido: string;
  fotoUrl?: string; // Puede venir vacío
}

function EstudianteCard({ nombre, apellido, fotoUrl }: Props) {
  return (
    <div className="card shadow-sm text-center h-100">
      <div className="card-body">
        <img
          src={fotoUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTM0Pz_2cRRjKmHuneMil_H_ygU2Ul8wxVSdA&s'}
          alt={`Foto de ${nombre}`}
          className="rounded-circle mb-3"
          style={{ width: '100px', height: '100px', objectFit: 'cover' }}
        />
        <h5 className="card-title mb-0">{nombre} {apellido}</h5>
      </div>
    </div>
  );
}

export default EstudianteCard;
