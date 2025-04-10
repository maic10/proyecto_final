import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../../state/auth';
import { 
  obtenerAsistenciasResumen,
  exportarAsistenciasExcel
} from '../../state/api';

import { AsistenciaResumen } from '../../types/asistencias';


function PaginaAsistencias() {
  // Lista de asistencias resumidas
  const [asistencias, setAsistencias] = useState<AsistenciaResumen[]>([]);
  // Estados para loading / error
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Filtros por fecha
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const navigate = useNavigate();
  const idClase = 'clase_001'; // fijo si el profesor solo tiene 1 clase

  useEffect(() => {
    // Opcional: cargarDatos(); 
    // si quieres que muestre algo al inicio sin pulsar "Buscar"
  }, []);

  // Lógica para llamar a /api/asistencias/resumen
  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      const usuario = obtenerUsuario();
      if (!usuario) {
        navigate('/');
        return;
      }
      const data = await obtenerAsistenciasResumen(idClase, fechaInicio, fechaFin);
      setAsistencias(data);
    } catch (err) {
      console.error('Error al cargar asistencias:', err);
      setError('No se pudo cargar la lista de asistencias');
    } finally {
      setCargando(false);
    }
  };

  // Navegación al detalle
  const handleVerDetalle = (fecha: string) => {
    navigate(`/asistencias/detalle?fecha=${fecha}&id_clase=${idClase}`);
  };

  // Cuando el usuario pulsa "Buscar"
  const handleBuscar = () => {
    cargarDatos();
  };

  // Botón para exportar a Excel
  const handleExportar = async () => {
    try {
      // Verifica que tengamos fechas, o decide cómo manejarlo
      if (!fechaInicio || !fechaFin) {
        alert("Por favor selecciona fecha inicio y fin antes de exportar");
        return;
      }
      await exportarAsistenciasExcel(idClase, fechaInicio, fechaFin);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      setError('No se pudo exportar el archivo');
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Resumen de Asistencias</h2>

      {/* Filtros por fecha */}
      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-3">
            <label htmlFor="fechaInicio" className="form-label">Fecha Inicio</label>
            <input
              type="date"
              id="fechaInicio"
              className="form-control"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="fechaFin" className="form-label">Fecha Fin</label>
            <input
              type="date"
              id="fechaFin"
              className="form-control"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button className="btn btn-primary w-100" onClick={handleBuscar}>
              Buscar
            </button>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button 
              className="btn btn-success w-100" 
              onClick={handleExportar}
            >
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {cargando && <p>Cargando...</p>}

      {!cargando && asistencias.length === 0 && (
        <p>No hay asistencias en ese rango de fechas.</p>
      )}

      {!cargando && asistencias.length > 0 && (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Aula</th>
              <th>Clase</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {asistencias.map((item, idx) => (
              <tr key={idx}>
                <td>{item.fecha}</td>
                <td>{item.nombre_aula}</td>
                <td>{item.nombre_clase}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleVerDetalle(item.fecha)}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PaginaAsistencias;
