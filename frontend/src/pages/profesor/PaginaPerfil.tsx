import React, { useState, useEffect } from 'react';
import { obtenerUsuario } from '../../state/auth';
import { obtenerPerfil, cambiarContrasena } from '../../state/api';

interface PerfilUsuario {
  name: string;
  email: string;
  role: string;
}

const MIN_PASSWORD_LENGTH = 6; // Mínimo de caracteres para la contraseña
const MESSAGE_DURATION = 2000; // Duración de los mensajes en milisegundos 

/**
 * Página de perfil del usuario.
 * Permite ver la información del perfil y cambiar la contraseña.
 */

const PaginaPerfil: React.FC = () => {
  const usuario = obtenerUsuario();
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [contrasenaActual, setContrasenaActual] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Obtiene el perfil del usuario al cargar la página
  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        const data = await obtenerPerfil();
        setPerfil({ name: data.name, email: data.email, role: data.role });
      } catch (err) {
        setError('No se pudo cargar el perfil: ' + err.message);
      }
    };
    fetchPerfil();
  }, []);

  // Muestra mensajes de éxito o error por un tiempo limitado
  const mostrarMensaje = (setter: React.Dispatch<React.SetStateAction<string | null>>, mensaje: string) => {
    setter(mensaje);
    setTimeout(() => setter(null), MESSAGE_DURATION);
  };

  // Maneja el cambio de contraseña del usuario
  const handleCambiarContrasena = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar la longitud de la nueva contraseña
    if (nuevaContrasena.length < MIN_PASSWORD_LENGTH) {
      mostrarMensaje(setError, `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }

    try {
      const response = await cambiarContrasena(contrasenaActual, nuevaContrasena);
      setMostrarFormulario(false); // Ocultar el formulario
      setContrasenaActual('');
      setNuevaContrasena('');
      mostrarMensaje(setExito, 'Contraseña actualizada con éxito');
    } catch (err) {
      // Extraer el mensaje de error del cuerpo de la respuesta
      const mensajeError = err.response?.data?.error || err.message || 'Error desconocido';
      if (mensajeError.includes('La contraseña actual es incorrecta')) {
        mostrarMensaje(setError, 'Contraseña incorrecta');
      } else if (mensajeError.includes('Usuario no encontrado')) {
        mostrarMensaje(setError, 'Usuario no encontrado');
      } else {
        mostrarMensaje(setError, 'No se pudo cambiar la contraseña');
      }
    }
  };

  if (!usuario) {
    return <div>No estás autenticado</div>;
  }

  if (!perfil) {
    return <div>Cargando perfil...</div>;
  }

  return (
    <div style={{ maxWidth: '700px', margin: '50px auto', padding: '20px' }}>
      <div className="card shadow-sm border-0">
        <div className="card-body">
          {/* Encabezado con avatar y título */}
          <div className="d-flex align-items-center mb-4">
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3"
              style={{ width: '60px', height: '60px', fontSize: '24px' }}
            >
              {perfil.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="mb-0">{perfil.name}</h3>
              <p className="text-muted mb-0">Rol: {perfil.role.charAt(0).toUpperCase() + perfil.role.slice(1)}</p>
            </div>
          </div>

          {/* Información del perfil */}
          <div className="mb-4">
            <h5>Información del Perfil</h5>
            <p><strong>Nombre:</strong> {perfil.name}</p>
            <p><strong>Correo:</strong> {perfil.email}</p>
          </div>

          {/* Mensaje de éxito fuera del formulario */}
          {exito && <div className="alert alert-success">{exito}</div>}

          {/* Botón para mostrar el formulario de cambio de contraseña */}
          {!mostrarFormulario && (
            <div className="mb-4">
              <button
                className="btn btn-outline-primary"
                onClick={() => setMostrarFormulario(true)}
              >
                Cambiar Contraseña
              </button>
            </div>
          )}

          {/* Formulario de cambio de contraseña  */}
          {mostrarFormulario && (
            <div className="mb-4">
              <h5>Cambiar Contraseña</h5>
              <form onSubmit={handleCambiarContrasena}>
                <div className="mb-3">
                  <label htmlFor="contrasenaActual" className="form-label">Contraseña Actual</label>
                  <input
                    type="password"
                    id="contrasenaActual"
                    className="form-control"
                    value={contrasenaActual}
                    onChange={(e) => setContrasenaActual(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="nuevaContrasena" className="form-label">Nueva Contraseña</label>
                  <input
                    type="password"
                    id="nuevaContrasena"
                    className="form-control"
                    value={nuevaContrasena}
                    onChange={(e) => setNuevaContrasena(e.target.value)}
                    required
                  />
                  <small className="form-text text-muted">
                    La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary">
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setMostrarFormulario(false)}
                  >
                    Cancelar
                  </button>
                </div>
                {/* Mensaje de error debajo del formulario */}
                {error && <div className="alert alert-danger mt-3">{error}</div>}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaginaPerfil;