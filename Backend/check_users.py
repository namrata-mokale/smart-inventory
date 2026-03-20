import sqlite3
import os

db_path = os.path.join('..', 'instance', 'inventory.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, name, email, phone, address FROM users;")
rows = cursor.fetchall()
print(f"Users: {rows}")
conn.close()
