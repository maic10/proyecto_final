import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarSesion, estaAutenticado, obtenerUsuario } from '../../state/auth';
import { iniciarSesion } from '../../state/api';
import { useAuth } from '../../state/useAuth';

/**
 * Página de inicio de sesión.
 * Permite al usuario autenticarse y redirige según su rol.
 */
function PaginaInicioSesion() {
  const [correo, setCorreo] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();
  const { verificarToken } = useAuth();

  // Redirige automáticamente si el usuario ya está autenticado
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

  // Maneja el envío del formulario de inicio de sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    if (contraseña.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setCargando(false);
      return;
    }

    try {
      // Llama a la API para iniciar sesión y guarda la sesión si es correcto
      const { token, id_usuario, rol } = await iniciarSesion(correo, contraseña);
      guardarSesion(token, id_usuario, rol);

      await verificarToken();
      // Redirige según el rol del usuario
      if (rol === 'admin') {
        navigate('/admin');
      } else {
        navigate('/inicio');
      }
    } catch (err: any) {
      const mensajeError = err.response?.data?.error || 'Credenciales inválidas o error de conexión';
      setError(mensajeError);
    } finally {
      setCargando(false);
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
              autoComplete="username" 
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
              autoComplete="current-password" 
            />
            <div id="contraseñaHelp" className="form-text">
              La contraseña debe tener al menos 6 caracteres.
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