import sys
import os
import sqlite3

def check_db(db_path):
    print(f"\n--- CHECKING {db_path} ---")
    if not os.path.exists(db_path): return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\nTABLE: supply_requests")
    cursor.execute("SELECT id, shop_id, product_id, status FROM supply_requests")
    for r in cursor.fetchall():
        cursor.execute("SELECT name FROM shops WHERE id=?", (r[1],))
        shop_name = cursor.fetchone()
        shop_name = shop_name[0] if shop_name else "Unknown"
        
        cursor.execute("SELECT name, sku FROM products WHERE id=?", (r[2],))
        product_data = cursor.fetchone()
        product_name = product_data[0] if product_data else "Unknown"
        product_sku = product_data[1] if product_data else "Unknown"
        
        print(f"Request ID: {r[0]}, Shop: {shop_name} (ID: {r[1]}), Product: {product_name} (ID: {r[2]}, SKU: {product_sku}), Status: {r[3]}")
    
    conn.close()

check_db('Backend/instance/inventory.db')
