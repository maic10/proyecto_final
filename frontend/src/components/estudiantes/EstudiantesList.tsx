// src/components/EstudiantesList.tsx
import React from 'react';
import EstudianteCard from './EstudianteCard';
import { Estudiante } from '../../types';

interface EstudiantesListProps {
  estudiantes: Estudiante[];
  estudiantesFiltrados: Estudiante[];
  busqueda: string;
  orden: 'asc' | 'desc';
  onBusquedaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOrdenChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onEstudianteClick: (estudiante: Estudiante, buttonRef: HTMLButtonElement) => void;
  onVolver: () => void;
  cargando: boolean;
}

const EstudiantesList: React.FC<EstudiantesListProps> = ({
  estudiantes,
  estudiantesFiltrados,
  busqueda,
  orden,
  onBusquedaChange,
  onOrdenChange,
  onEstudianteClick,
  onVolver,
  cargando,
}) => {
  return (
    <>
      <div className="row mb-5 align-items-center">
        <div className="col-md-6">
          <h1 className="display-5 fw-bold text-primary mb-2">
            <i className="bi bi-people me-2"></i>Estudiantes
          </h1>
          <p className="lead text-muted">
            Tienes {estudiantesFiltrados.length} {estudiantesFiltrados.length === 1 ? 'estudiante' : 'estudiantes'} en esta clase
          </p>
        </div>
        <div className="col-md-6 d-flex justify-content-end align-items-center gap-3">
          <div className="input-group" style={{ maxWidth: '300px' }}>
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Buscar estudiante..."
              value={busqueda}
              onChange={onBusquedaChange}
              style={{ borderRadius: '0 5px 5px 0' }}
            />
          </div>
          <select
            className="form-select"
            style={{ maxWidth: '150px' }}
            value={orden}
            onChange={onOrdenChange}
          >
            <option value="asc">Nombre (A-Z)</option>
            <option value="desc">Nombre (Z-A)</option>
          </select>
          <button className="btn btn-outline-primary" onClick={onVolver}>
            <i className="bi bi-arrow-left me-2"></i>Volver a Clases
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando estudiantes...</p>
        </div>
      ) : estudiantes.length === 0 ? (
        <div className="alert alert-info text-center" role="alert">
          No hay estudiantes en esta clase.
        </div>
      ) : estudiantesFiltrados.length === 0 ? (
        <div className="alert alert-warning text-center" role="alert">
          No se encontraron estudiantes que coincidan con tu búsqueda.
        </div>
      ) : (
        <div className="row g-4">
          {estudiantesFiltrados.map((est) => (
            <div key={est.id_estudiante} className="col-6 col-md-4 col-lg-3">
              <div>
                <EstudianteCard
                  nombre={est.nombre}
                  apellido={est.apellido}
                  fotoBase64={est.imagenes?.[0]?.data}
                  fotoMimetype={est.imagenes?.[0]?.mimetype}
                  //idEstudiante={est.id_estudiante}
                  onClick={(buttonRef) => onEstudianteClick(est, buttonRef)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default EstudiantesList;