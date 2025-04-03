import { useEffect, useState } from 'react';
import axios from 'axios';
import { obtenerToken } from '../state/auth';

function PaginaTransmision() {
  const token = obtenerToken();
  const idClaseActual = "clase_001"; // Podría ser dinámico en producción

  const [registros, setRegistros] = useState([]);
  const [hayTransmision, setHayTransmision] = useState(false);

  const cargarAsistenciaActual = async () => {
    try {
      const res = await axios.get(`/api/asistencias/actual?id_clase=${idClaseActual}&fecha=2025-03-24`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistros(res.data.registros || []);
    } catch (err) {
      console.error("Error consultando asistencia actual", err);
    }
  };

  const verificarEstadoTransmision = async () => {
    try {
      const res = await axios.post(`/api/transmision/estado`, {
        id_raspberry_pi: "rpi_001"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHayTransmision(res.data.transmitir);
    } catch (err) {
      console.error("Error verificando estado de transmisión", err);
      setHayTransmision(false);
    }
  };

  const corregirEstado = async (idEst: string, nuevoEstado: string) => {
    try {
      await axios.put(`/api/asistencias/${idEst}`, 
        { estado: nuevoEstado }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      cargarAsistenciaActual(); // Refrescar
    } catch (err) {
      console.error("Error actualizando estado", err);
    }
  };

  // Cargar asistencia periódicamente
  useEffect(() => {
    const interval = setInterval(cargarAsistenciaActual, 3000);
    return () => clearInterval(interval);
  }, []);

  // Verificar estado de la transmisión cada 10s
  useEffect(() => {
    verificarEstadoTransmision(); // inicial
    const interval = setInterval(verificarEstadoTransmision, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <h2>Transmisión en Vivo</h2>
      <img
        src={`http://127.0.0.1:5000/api/transmision/video/${idClaseActual}`}
        alt="Video en vivo"
        style={{ width: '640px', height: '480px', border: '2px solid #333' }}
      />
      <h3>Asistencia en tiempo real</h3>
      <table className="table">
        <thead>
          <tr><th>Estudiante</th><th>Estado</th><th>Acción</th></tr>
        </thead>
        <tbody>
          {registros.map((r: any) => (
            <tr key={r.id_estudiante}>
              <td>{r.id_estudiante}</td>
              <td>{r.estado}</td>
              <td>
                <select 
                  onChange={(e) => corregirEstado(r.id_estudiante, e.target.value)}
                  value={r.estado}
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="duda">Duda</option>
                  <option value="ausente">Ausente</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PaginaTransmision;
