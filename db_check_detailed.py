import sys
import os
import sqlite3

def check_db(db_path):
    print(f"\n--- CHECKING {db_path} ---")
    if not os.path.exists(db_path): 
        print("Not found.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\nTABLE: suppliers")
    cursor.execute("SELECT id, company_name, user_id FROM suppliers")
    for row in cursor.fetchall():
        print(f"Supplier ID: {row[0]}, Name: {row[1]}, User ID: {row[2]}")
        print("Linked Shops:")
        cursor.execute("SELECT shop_id FROM supplier_shops WHERE supplier_id=?", (row[0],))
        shops = cursor.fetchall()
        for shop in shops:
            cursor.execute("SELECT id, name FROM shops WHERE id=?", (shop[0],))
            shop_data = cursor.fetchone()
            if shop_data:
                print(f"  - Shop ID: {shop_data[0]}, Name: {shop_data[1]}")
            else:
                print(f"  - Shop ID: {shop[0]} (NOT FOUND IN SHOPS TABLE)")
        
        print("Catalog Items:")
        cursor.execute("SELECT sku, name, base_price FROM supplier_catalog WHERE supplier_id=?", (row[0],))
        catalog = cursor.fetchall()
        for item in catalog:
            print(f"  - SKU: {item[0]}, Name: {item[1]}, Price: {item[2]}")
        print("-" * 20)

    print("\nTABLE: shops")
    cursor.execute("SELECT id, name, owner_id FROM shops")
    for row in cursor.fetchall():
        print(f"Shop ID: {row[0]}, Name: {row[1]}, Owner ID: {row[2]}")

    print("\nTABLE: supply_requests")
    try:
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
    except Exception as e:
        print(f"Error reading supply_requests: {e}")
        
    conn.close()

check_db('instance/inventory.db')
check_db('Backend/instance/inventory.db')
