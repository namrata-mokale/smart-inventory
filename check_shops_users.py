import sqlite3
import os

db_path = os.path.join('Backend', 'instance', 'inventory.db')
if not os.path.exists(db_path):
    db_path = os.path.join('instance', 'inventory.db')

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("--- Checking 'shops' table ---")
cursor.execute("SELECT * FROM shops")
rows = cursor.fetchall()
for row in rows:
    print(row)

print("\n--- Checking 'users' table ---")
cursor.execute("SELECT id, username, role FROM users")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
