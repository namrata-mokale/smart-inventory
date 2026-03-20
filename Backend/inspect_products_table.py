import sqlite3
import os

db_path = os.path.join('instance', 'inventory.db')
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(products);")
    columns = cursor.fetchall()
    print("Columns in 'products' table:")
    for col in columns:
        print(f"ID: {col[0]}, Name: {col[1]}, Type: {col[2]}, NotNull: {col[3]}, Default: {col[4]}, PK: {col[5]}")
    conn.close()
