import sqlite3
import os

def check_db(db_path):
    print(f"\n--- CHECKING {db_path} ---")
    if not os.path.exists(db_path): return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\nTABLE: products")
    cursor.execute("SELECT id, name, sku, shop_id FROM products")
    for row in cursor.fetchall():
        print(row)
        
    conn.close()

check_db('instance/inventory.db')
