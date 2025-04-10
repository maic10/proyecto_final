// src/pages/common/PaginaInicioSesion.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarSesion, obtenerUsuario, estaAutenticado, obtenerToken } from '../../state/auth';
import { iniciarSesion } from '../../state/api';

function PaginaInicioSesion() {
  const [correo, setCorreo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false); // Estado para manejar la carga
  const navigate = useNavigate();

  // Redirigir si el usuario ya está autenticado
  useEffect(() => {
    if (estaAutenticado()) {
      const usuario = obtenerUsuario();
      if (usuario) {
        if (usuario.rol === 'admin') {
          navigate('/admin');
        } else {
          navigate('/inicio');
        }
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true); // Mostrar estado de carga

    // Validación básica de la contraseña (por ejemplo, longitud mínima)
    if (contraseña.length < 3) {
      setError('La contraseña debe tener al menos 3 caracteres');
      setCargando(false);
      return;
    }

    try {
      const { token, id_usuario, rol } = await iniciarSesion(correo, contraseña);
      console.log('Datos recibidos al iniciar sesión:', { token, id_usuario, rol });

      guardarSesion(token, id_usuario, rol);
      console.log('Token guardado:', obtenerToken()); // Usar obtenerToken en lugar de localStorage

      // Redirigir según el rol
      if (rol === 'admin') {
        navigate('/admin');
      } else {
        navigate('/inicio');
      }
    } catch (err: any) {
      // Mostrar un mensaje de error más específico si está disponible
      const mensajeError = err.response?.data?.error || 'Credenciales inválidas o error de conexión';
      setError(mensajeError);
    } finally {
      setCargando(false); // Ocultar estado de carga
    }
  };

  return (
    <div className="container d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <h2 className="mb-4">Iniciar sesión</h2>

      <div className="card p-4 shadow" style={{ maxWidth: '400px', width: '100%' }}>
        <form onSubmit={handleLogin} aria-label="Formulario de inicio de sesión">
          <div className="mb-3">
            <label htmlFor="correo" className="form-label">Correo</label>
            <input
              type="email"
              className="form-control"
              id="correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              aria-describedby="correoHelp"
            />
            <div id="correoHelp" className="form-text">
              Ingresa tu correo electrónico registrado.
            </div>
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
              minLength={3}
              aria-describedby="contraseñaHelp"
            />
            <div id="contraseñaHelp" className="form-text">
              La contraseña debe tener al menos 3 caracteres.
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={cargando}
            aria-label="Iniciar sesión"
          >
            {cargando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PaginaInicioSesion;