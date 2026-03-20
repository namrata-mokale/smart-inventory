import sqlite3
import os

db_path = os.path.join('instance', 'inventory.db')
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        print("Adding 'qr_code' column to 'products' table...")
        cursor.execute("ALTER TABLE products ADD COLUMN qr_code VARCHAR(100);")
        conn.commit()
        print("Column added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Error adding column: {e}")
    conn.close()
