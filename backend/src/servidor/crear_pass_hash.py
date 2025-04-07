import bcrypt
contraseña = "4321"  # La contraseña que quieras
hashed = bcrypt.hashpw(contraseña.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
print(hashed)