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

print("--- Checking 'transactions' table schema ---")
cursor.execute("PRAGMA table_info(transactions)")
columns = cursor.fetchall()
for col in columns:
    print(col)

print("\n--- Checking 'salesmen' table schema ---")
cursor.execute("PRAGMA table_info(salesmen)")
columns = cursor.fetchall()
for col in columns:
    print(col)

conn.close()
