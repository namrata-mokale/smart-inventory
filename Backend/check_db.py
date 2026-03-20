import sqlite3
import os

db_path = os.path.join('instance', 'inventory.db')
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Tables: {tables}")
    if ('suppliers',) in tables:
        cursor.execute("SELECT * FROM suppliers;")
        rows = cursor.fetchall()
        print(f"Suppliers count: {len(rows)}")
        for row in rows:
            print(row)
    conn.close()
