import { useState } from 'react'; // Manejar el estado local del componente 
import { useNavigate } from 'react-router-dom';
import { guardarSesion } from '../state/auth';
import { iniciarSesion } from '../state/api';

function PaginaInicioSesion() {
  const [correo, setCorreo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const { token, id_usuario, rol } = await iniciarSesion(correo, contraseña);
      console.log('Datos recibidos al iniciar sesión:', { token, id_usuario, rol }); // Para depurar

      guardarSesion(token, id_usuario, rol);
      console.log('Token guardado:', localStorage.getItem('token')); // Para depurar

      navigate('/inicio');
    } catch (err) {
      setError('Credenciales inválidas o error de conexión');
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <h2 className="mb-4">Iniciar sesión</h2>

      <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label htmlFor="correo" className="form-label">Correo</label>
            <input
              type="email"
              className="form-control"
              id="correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="contraseña" className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-control"
              id="contraseña"
              value={contraseña}
              onChange={(e) => setContraseña(e.target.value)}
              required
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button type="submit" className="btn btn-primary w-100">
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

export default PaginaInicioSesion;