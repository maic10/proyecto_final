// src/components/ClasesList.tsx
import React from 'react';
import ClaseSelectorCard from './ClaseSelectorCard';

interface Clase {
  id_clase: string;
  id_asignatura: string;
  nombre_asignatura: string;
  horarios: { dia: string; hora_inicio: string; hora_fin: string; id_aula: string; nombre_aula: string }[];
}

interface ClasesListProps {
  clases: Clase[];
  onClaseClick: (clase: Clase) => void;
}

const ClasesList: React.FC<ClasesListProps> = ({ clases, onClaseClick }) => {
  return (
    <div className="row g-4">
      {clases.map((clase) => (
        <div key={clase.id_clase} className="col-md-6 col-lg-4">
          <ClaseSelectorCard
            nombreAsignatura={clase.nombre_asignatura}
            onClick={() => onClaseClick(clase)}
          />
        </div>
      ))}
    </div>
  );
};

export default ClasesList;