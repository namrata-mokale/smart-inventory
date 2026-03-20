import sqlite3
import os

db_path = os.path.join('..', 'instance', 'inventory.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(suppliers);")
print(f"Columns: {cursor.fetchall()}")
cursor.execute("SELECT * FROM suppliers;")
rows = cursor.fetchall()
print(f"Rows: {rows}")
conn.close()
