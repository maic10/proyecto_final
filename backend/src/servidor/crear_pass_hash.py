import bcrypt
contraseña = "1234"  # La contraseña que quieras
hashed = bcrypt.hashpw(contraseña.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
print(hashed)