import sys
import os
import sqlite3

def check_db(db_path):
    print(f"\n--- CHECKING {db_path} ---")
    if not os.path.exists(db_path): return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("TABLE: supplier_shops (ALL ENTRIES)")
    cursor.execute("SELECT * FROM supplier_shops")
    for row in cursor.fetchall():
        print(row)

    print("\nTABLE: suppliers (ALL ENTRIES)")
    cursor.execute("SELECT id, company_name, user_id FROM suppliers")
    for row in cursor.fetchall():
        print(row)
        
    conn.close()

check_db('instance/inventory.db')
