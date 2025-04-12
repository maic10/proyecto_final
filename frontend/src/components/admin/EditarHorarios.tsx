// src/components/admin/EditarHorarios.tsx
import { useState } from 'react';
import { Horario, Aula } from '../../types/horarios';

interface EditarHorariosProps {
  horarios: Horario[];
  setHorarios: React.Dispatch<React.SetStateAction<Horario[]>>;
  aulas: Aula[];
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  cargando: boolean;
  setCargando: React.Dispatch<React.SetStateAction<boolean>>;
  diasValidos: string[];
  nombresDias: { [key: string]: string };
  validarSuperposicion: (nuevoHorario: Horario) => Promise<string | null>;
  onSave: (nuevosHorarios: Horario[]) => void;
  onCancel: () => void;
  mensajeExito: string | null;
  nombreAsignatura: string;
  nombreProfesor: string;
}

const EditarHorarios: React.FC<EditarHorariosProps> = ({
  horarios,
  setHorarios,
  aulas,
  error,
  setError,
  cargando,
  setCargando,
  diasValidos,
  nombresDias,
  validarSuperposicion,
  onSave,
  onCancel,
  mensajeExito,
  nombreAsignatura,
  nombreProfesor
}) => {
  const [nuevoHorario, setNuevoHorario] = useState<Horario>({
    dia: '',
    hora_inicio: '',
    hora_fin: '',
    id_aula: ''
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [indexToDelete, setIndexToDelete] = useState<number | null>(null);

  // Validar superposición dentro de la misma clase
  const validarSuperposicionEnClaseActual = (nuevoHorario: Horario) => {
    for (const horarioExistente of horarios) {
      if (editIndex !== null && horarios[editIndex] === horarioExistente) {
        continue; // Ignorar el horario que se está editando
      }
      if (nuevoHorario.dia === horarioExistente.dia) {
        if (
          (nuevoHorario.hora_inicio < horarioExistente.hora_fin) &&
          (nuevoHorario.hora_fin > horarioExistente.hora_inicio)
        ) {
          return `El horario se superpone con otro horario de la misma clase: ${nombresDias[horarioExistente.dia as keyof typeof nombresDias]} ${horarioExistente.hora_inicio}-${horarioExistente.hora_fin}`;
        }
      }
    }
    return null;
  };

  // Validar si el horario ya existe en la clase actual (ignorando el aula)
  const validarHorarioDuplicado = (nuevoHorario: Horario) => {
    for (const horarioExistente of horarios) {
      if (editIndex !== null && horarios[editIndex] === horarioExistente) {
        continue; // Ignorar el horario que se está editando
      }
      if (
        nuevoHorario.dia === horarioExistente.dia &&
        nuevoHorario.hora_inicio === horarioExistente.hora_inicio &&
        nuevoHorario.hora_fin === horarioExistente.hora_fin
      ) {
        return 'Este horario ya existe en la clase (mismo día y horas).';
      }
    }
    return null;
  };

  const handleAddOrUpdateHorario = async () => {
    setError(null);

    // Validaciones básicas
    // descomentarlo en prod
    /*
    if (!diasValidos.includes(nuevoHorario.dia)) {
      setError('El día debe ser de lunes a viernes.');
      return;
    }
    */

    // descomentarlo en prod
    /*
    if (nuevoHorario.hora_inicio < '08:00' || nuevoHorario.hora_fin > '22:00') {
      setError('El horario debe estar entre 08:00 y 22:00.');
      return;
    }
      */

    if (nuevoHorario.hora_inicio >= nuevoHorario.hora_fin) {
      setError('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }

    if (!aulas.some(aula => aula.id_aula === nuevoHorario.id_aula)) {
      setError('El aula seleccionada no es válida.');
      return;
    }

    // Validar si el horario ya existe en la clase actual (ignorando el aula)
    const duplicadoError = validarHorarioDuplicado(nuevoHorario);
    if (duplicadoError) {
      setError(duplicadoError);
      return;
    }

    // Validar superposición dentro de la misma clase
    const superposicionClaseError = validarSuperposicionEnClaseActual(nuevoHorario);
    if (superposicionClaseError) {
      setError(superposicionClaseError);
      return;
    }

    // Validar superposición con otros horarios del mismo profesor (en otras clases)
    const superposicionError = await validarSuperposicion(nuevoHorario);
    if (superposicionError) {
      setError(superposicionError);
      return;
    }

    const nuevosHorarios = [...horarios];
    if (editIndex !== null) {
      nuevosHorarios[editIndex] = nuevoHorario;
      setEditIndex(null);
    } else {
      nuevosHorarios.push(nuevoHorario);
    }
    setHorarios(nuevosHorarios);
    // Reiniciar el formulario a valores vacíos
    setNuevoHorario({ dia: '', hora_inicio: '', hora_fin: '', id_aula: '' });
  };

  const handleEditHorario = (index: number) => {
    setEditIndex(index);
    setNuevoHorario(horarios[index]);
  };

  const handleDeleteHorario = (index: number) => {
    setIndexToDelete(index);
    setShowConfirmModal(true);
  };

  const confirmDelete = () => {
    if (indexToDelete !== null) {
      const nuevosHorarios = horarios.filter((_, i) => i !== indexToDelete);
      setHorarios(nuevosHorarios);
      setShowConfirmModal(false);
      setIndexToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
    setIndexToDelete(null);
  };

  // Mapear id_aula a nombre del aula
  const getNombreAula = (idAula: string) => {
    const aula = aulas.find(a => a.id_aula === idAula);
    return aula ? aula.nombre : idAula;
  };

  return (
    <div className="container py-5">
      <h2 className="mb-2">Editar Horarios</h2>
      {(nombreAsignatura || nombreProfesor) && (
        <p className="mb-4 text-muted">
          Clase: {nombreAsignatura || 'Desconocida'} - Profesor: {nombreProfesor || 'Desconocido'}
        </p>
      )}

      {mensajeExito && (
        <div className="alert alert-success" role="alert" aria-live="assertive">
          {mensajeExito}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Lista de horarios actuales */}
      {horarios.length > 0 ? (
        <ul className="list-group mb-3" role="list" aria-label="Lista de horarios">
          {horarios.map((horario, index) => (
            <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
              {nombresDias[horario.dia as keyof typeof nombresDias]}: {horario.hora_inicio} - {horario.hora_fin} (Aula: {getNombreAula(horario.id_aula)})
              <div>
                <button
                  className="btn btn-warning btn-sm me-2"
                  onClick={() => handleEditHorario(index)}
                  aria-label={`Editar horario ${index + 1}`}
                >
                  Editar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteHorario(index)}
                  aria-label={`Eliminar horario ${index + 1}`}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No hay horarios asignados.</p>
      )}

      {/* Formulario para agregar/editar horario */}
      <div className="card p-3 mb-3">
        <h5>{editIndex !== null ? 'Editar Horario' : 'Agregar Horario'}</h5>
        {aulas.length === 0 ? (
          <p className="text-muted">No hay aulas disponibles. Por favor, crea una aula primero.</p>
        ) : (
          <div className="row g-3">
            <div className="col-md-3">
              <label htmlFor="dia" className="form-label">Día</label>
              <select
                id="dia"
                className="form-select"
                value={nuevoHorario.dia}
                onChange={(e) => setNuevoHorario({ ...nuevoHorario, dia: e.target.value })}
                aria-label="Seleccionar día"
              >
                <option value="">Selecciona un día</option>
                {diasValidos.map(dia => (
                  <option key={dia} value={dia}>{nombresDias[dia as keyof typeof nombresDias]}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="hora_inicio" className="form-label">Hora Inicio</label>
              <input
                type="time"
                id="hora_inicio"
                className="form-control"
                value={nuevoHorario.hora_inicio}
                onChange={(e) => setNuevoHorario({ ...nuevoHorario, hora_inicio: e.target.value })}
                min="08:00"
                max="22:00"
                placeholder="Selecciona una hora"
                aria-label="Hora de inicio"
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="hora_fin" className="form-label">Hora Fin</label>
              <input
                type="time"
                id="hora_fin"
                className="form-control"
                value={nuevoHorario.hora_fin}
                onChange={(e) => setNuevoHorario({ ...nuevoHorario, hora_fin: e.target.value })}
                min="08:00"
                max="22:00"
                placeholder="Selecciona una hora"
                aria-label="Hora de fin"
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="id_aula" className="form-label">Aula</label>
              <select
                id="id_aula"
                className="form-select"
                value={nuevoHorario.id_aula}
                onChange={(e) => setNuevoHorario({ ...nuevoHorario, id_aula: e.target.value })}
                aria-label="Seleccionar aula"
              >
                <option value="">Selecciona un aula</option>
                {aulas.map(aula => (
                  <option key={aula.id_aula} value={aula.id_aula}>
                    {aula.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <button
          className="btn btn-primary mt-3"
          onClick={handleAddOrUpdateHorario}
          disabled={cargando || aulas.length === 0}
          aria-label={editIndex !== null ? 'Actualizar horario' : 'Agregar horario'}
        >
          {editIndex !== null ? 'Actualizar Horario' : 'Agregar Horario'}
        </button>
      </div>

      {/* Modal de confirmación para eliminar */}
      <div className={`modal fade ${showConfirmModal ? 'show d-block' : ''}`} tabIndex={-1} role="dialog" style={{ backgroundColor: showConfirmModal ? 'rgba(0,0,0,0.5)' : 'transparent' }}>
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirmar Eliminación</h5>
              <button type="button" className="btn-close" onClick={cancelDelete} aria-label="Cerrar"></button>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que deseas eliminar este horario?</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={cancelDelete}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Botones para guardar o cancelar */}
      <div className="d-flex justify-content-between">
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={cargando}
          aria-label="Cancelar"
        >
          Cancelar
        </button>
        <button
          className="btn btn-success"
          onClick={() => onSave(horarios)}
          disabled={cargando}
          aria-label="Guardar cambios"
        >
          {cargando ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Guardando...
            </>
          ) : (
            'Guardar Cambios'
          )}
        </button>
      </div>
    </div>
  );
};

export default EditarHorarios;