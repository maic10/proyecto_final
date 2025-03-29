import { useEffect, useState } from 'react';
import axios from 'axios';

function PaginaTransmision() {
  console.log("Cargando página de transmisión"); // Depurar
  const [registros, setRegistros] = useState([]);
  
  const cargarAsistenciaActual = async () => {
    try {
      const res = await axios.get(`/api/asistencias/actual?id_clase=clase_001&fecha=2025-03-24`, {
        headers: { Authorization: `Bearer token` }
      });
      setRegistros(res.data.registros || []);
    } catch (err) {
      console.error("Error consultando asistencia actual", err);
    }
  };

  // Polling cada 3 seg
  useEffect(() => {
    const interval = setInterval(cargarAsistenciaActual, 3000);
    return () => clearInterval(interval);
  }, []);

  const corregirEstado = async (idEst, nuevoEstado) => {
    try {
      await axios.put(`/api/asistencias/${idEst}`, 
        { estado: nuevoEstado }, 
        { headers: { Authorization: `Bearer token` } }
      );
      // refrescar
      cargarAsistenciaActual();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="container">
      <h2>Transmisión en Vivo</h2>

      {/* Mjpeg */}
      <img
        src="http://127.0.0.1:5000/api/transmision/video"
        alt="Video en vivo"
        style={{ width: '640px', height: '480px' }}
      />

      <h3>Asistencia en tiempo real</h3>
      <table className="table">
        <thead>
          <tr><th>Estudiante</th><th>Estado</th><th>Acción</th></tr>
        </thead>
        <tbody>
          {registros.map(r => (
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
