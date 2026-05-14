"""
LOOPRA - Alta de Cliente
Registra un usuario en Supabase Auth y crea su perfil en public.clients.
"""
import os
import sys
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

def main():
    parser = argparse.ArgumentParser(description="Registrar un nuevo cliente en Loopra")
    parser.add_argument("--email", required=True, help="Email del cliente")
    parser.add_argument("--password", required=True, help="Contraseña (min 6 caracteres)")
    parser.add_argument("--name", required=True, help="Nombre comercial de la empresa")
    parser.add_argument("--industry", default="General", help="Sector o industria")
    
    args = parser.parse_args()

    # 1. Cargar entorno
    load_dotenv()
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_KEY en .env")
        sys.exit(1)

    print(f"\n🚀 Iniciando registro para: {args.name} ({args.email})")

    try:
        # Se requiere la SERVICE KEY para usar auth.admin
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        
        # 2. Crear usuario en Auth
        print("⏳ Creando cuenta en Supabase Auth...")
        user_response = supabase.auth.admin.create_user({
            "email": args.email,
            "password": args.password,
            "email_confirm": True # Entra directo sin verificar email
        })
        
        auth_user_id = user_response.user.id
        print(f"✅ Cuenta creada. Auth ID: {auth_user_id}")

        # 3. Insertar en public.clients
        print("⏳ Creando perfil en public.clients...")
        client_data = {
            "name": args.name,
            "industry": args.industry,
            "auth_user_id": auth_user_id
        }
        
        db_response = supabase.table("clients").insert(client_data).execute()
        
        client_id = db_response.data[0]['id']
        print(f"✅ Perfil creado exitosamente.")
        print("\n===========================================")
        print(f"🎉 CLIENTE REGISTRADO: {args.name}")
        print(f"🔑 Client ID (Para n8n): {client_id}")
        print("===========================================\n")

    except Exception as e:
        error_msg = str(e)
        if "User already registered" in error_msg:
            print(f"❌ Error: El email '{args.email}' ya está registrado.")
        elif "Password should be at least" in error_msg:
            print("❌ Error: La contraseña debe tener al menos 6 caracteres.")
        else:
            print(f"❌ Error crítico: {error_msg}")
        sys.exit(1)

if __name__ == "__main__":
    main()
