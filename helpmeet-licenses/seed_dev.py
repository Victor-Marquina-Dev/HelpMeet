"""Seed de desarrollo: crea una licencia de prueba para activar Helpmeet localmente."""
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "helpmeet_licenses.db"
NOW = datetime.now(timezone.utc).isoformat()

conn = sqlite3.connect(str(DB_PATH))

# Limpiar datos anteriores de desarrollo
conn.execute("DELETE FROM license_events")
conn.execute("DELETE FROM activations")
conn.execute("DELETE FROM licenses")
conn.execute("DELETE FROM customers")

# Cliente de prueba
conn.execute(
    "INSERT INTO customers (email, name, created_at) VALUES (?, ?, ?)",
    ("dev@localhost", "Dev Local", NOW),
)

# Licencia de prueba
raw_key = "HM-DEV-" + secrets.token_hex(8).upper()
key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
key_last4 = raw_key[-4:]

conn.execute(
    """INSERT INTO licenses (customer_id, key_hash, key_last4, plan, status, max_devices, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)""",
    (1, key_hash, key_last4, "personal", "active", 5, NOW),
)
conn.commit()
conn.close()

print(f"Product Key: {raw_key}")
print(f"Admin Key:  HM-2WH4-HQWS-V3A7-VXRX-LOCAL-DEV-2026")
