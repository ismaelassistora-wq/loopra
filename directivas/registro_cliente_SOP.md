# DIRECTIVA: REGISTRO_CLIENTE — Alta de Clientes en el SaaS Loopra

> **ID:** LOOPRA-ADMIN-001
> **Script Asociado:** `scripts/register_client.py`
> **Última Actualización:** 2026-04-23
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance

- **Objetivo Principal:** Registrar un nuevo cliente en el sistema. Esto implica crearle acceso (credenciales para Antigravity) y crear su perfil operativo (donde se guarda su tono de voz, industria, etc.).
- **Criterio de Éxito:** El usuario existe en la tabla `auth.users` de Supabase (sin necesidad de confirmar email) y tiene un registro vinculado en `public.clients` con su `auth_user_id`.

---

## 2. Especificaciones de Entrada/Salida (I/O)

### Entradas (Inputs)
- **Argumentos de Consola:**
  - `--email` (str): Email de acceso del cliente.
  - `--password` (str): Contraseña inicial (mínimo 6 caracteres).
  - `--name` (str): Nombre comercial de la empresa.
  - `--industry` (str, opcional): Sector (ej: Restauración, Clínica).
- **Variables de Entorno (.env):**
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`: Necesario para interactuar con `auth.admin`.

### Salidas (Outputs)
- **Artefactos:** Ninguno.
- **Retorno de Consola:** UUID del nuevo cliente generado, y mensaje de éxito o error.

---

## 3. Flujo Lógico (Algoritmo)

1. Cargar `.env` y validar credenciales de Supabase.
2. Usar `supabase.auth.admin.create_user()` para crear la cuenta de Auth. Se le pasa `email_confirm=True` para que pueda entrar directamente sin confirmar el correo.
3. Extraer el `auth_user_id` del usuario recién creado.
4. Insertar una nueva fila en la tabla `public.clients` con el `name`, `industry`, y el `auth_user_id`.
5. Devolver el ID interno de `clients` (este es el `client_id` que se usará en n8n y Supabase).

---

## 4. Restricciones y Casos Borde

- **Usuario Duplicado:** Si el email ya existe en `auth.users`, la API de Supabase lanzará un error "User already registered". El script debe atraparlo y mostrarlo.
- **Contraseña Débil:** Supabase exige al menos 6 caracteres por defecto.
- **Service Key Obligatoria:** Para usar `auth.admin` es 100% obligatorio usar la `SUPABASE_SERVICE_KEY`, nunca la `ANON_KEY`.

---

## 5. Historial de Aprendizaje

| Fecha | Error | Causa | Solución |
|-------|-------|-------|----------|
| — | — | — | — |
