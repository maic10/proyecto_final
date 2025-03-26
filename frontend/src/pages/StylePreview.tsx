import React from 'react';

const StylePreview: React.FC = () => {
  return (
    <div className="container py-4">
      <h2 className="mb-4">🎨 Vista previa de estilos</h2>

      {/* Botones */}
      <section className="mb-4">
        <h4>Botones</h4>
        <button className="btn btn-primary me-2">Primario</button>
        <button className="btn btn-secondary me-2">Secundario</button>
        <button className="btn btn-success me-2">Éxito</button>
        <button className="btn btn-warning me-2">Advertencia</button>
        <button className="btn btn-danger me-2">Peligro</button>
      </section>

      {/* Formulario */}
      <section className="mb-4">
        <h4>Formulario</h4>
        <form className="p-4 bg-white rounded shadow-sm">
          <div className="mb-3">
            <label className="form-label">Correo</label>
            <input type="email" className="form-control" placeholder="usuario@escuela.com" />
          </div>
          <div className="mb-3">
            <label className="form-label">Contraseña</label>
            <input type="password" className="form-control" />
          </div>
          <button type="submit" className="btn btn-primary">Iniciar sesión</button>
        </form>
      </section>

      {/* Tarjetas */}
      <section className="mb-4">
        <h4>Tarjeta</h4>
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h5 className="card-title">Clase: Matemáticas</h5>
            <p className="card-text">Horario: Lunes 08:00 - 09:00</p>
            <button className="btn btn-primary">Ver asistencia</button>
          </div>
        </div>
      </section>

      {/* Alerts */}
      <section className="mb-4">
        <h4>Mensajes (Alerts)</h4>
        <div className="alert alert-success">✔ Asistencia registrada correctamente</div>
        <div className="alert alert-warning">⚠ No hay estudiantes en esta clase</div>
        <div className="alert alert-danger">✖ Error de conexión con el servidor</div>
      </section>
    </div>
  );
};

export default StylePreview;
