"""
LOOPRA - Script de Verificación de Conexión Supabase
Comprueba que las tablas del esquema han sido creadas correctamente.
"""
import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

REQUIRED_TABLES = ["clients", "posts", "post_comments"]

def check_tables(supabase: Client) -> dict:
    results = {}
    for table in REQUIRED_TABLES:
        try:
            response = supabase.table(table).select("id").limit(1).execute()
            results[table] = {"status": "OK", "rows": len(response.data)}
        except Exception as e:
            results[table] = {"status": "ERROR", "detail": str(e)}
    return results

def check_storage_bucket(supabase: Client) -> dict:
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if "loopra" in bucket_names:
            return {"status": "OK", "buckets": bucket_names}
        else:
            return {"status": "WARNING", "detail": "Bucket 'loopra' no encontrado", "buckets": bucket_names}
    except Exception as e:
        return {"status": "ERROR", "detail": str(e)}

def main():
    print("\n=== LOOPRA — Verificación de Supabase ===\n")

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ ERROR: Faltan variables de entorno. Revisa tu archivo .env")
        sys.exit(1)

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Conexión establecida con: {SUPABASE_URL}\n")
    except Exception as e:
        print(f"❌ No se pudo conectar a Supabase: {e}")
        sys.exit(1)

    # Verificar tablas
    print("--- Verificando Tablas ---")
    table_results = check_tables(supabase)
    all_ok = True
    for table, result in table_results.items():
        icon = "✅" if result["status"] == "OK" else "❌"
        if result["status"] == "OK":
            print(f"{icon} tabla '{table}' → accesible (rows en sample: {result['rows']})")
        else:
            print(f"{icon} tabla '{table}' → {result['detail']}")
            all_ok = False

    # Verificar bucket
    print("\n--- Verificando Storage Bucket ---")
    bucket_result = check_storage_bucket(supabase)
    if bucket_result["status"] == "OK":
        print(f"✅ Bucket 'loopra' → encontrado")
    elif bucket_result["status"] == "WARNING":
        print(f"⚠️  {bucket_result['detail']}")
        print(f"   Buckets disponibles: {bucket_result.get('buckets', [])}")
        print("   → Ejecuta la sección 6 del SQL para crearlo.")
        all_ok = False
    else:
        print(f"❌ Error Storage: {bucket_result['detail']}")
        all_ok = False

    print("\n===========================================")
    if all_ok:
        print("🚀 Todo listo. El esquema de Loopra está operativo.")
    else:
        print("⚠️  Hay elementos pendientes. Ejecuta primero 'scripts/01_init_supabase.sql' en el SQL Editor de Supabase.")

    print("===========================================\n")
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(main())
