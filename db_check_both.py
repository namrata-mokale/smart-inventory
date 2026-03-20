import sys
import os
import sqlite3

def check_db(db_path):
    print(f"\n--- CHECKING {db_path} ---")
    if not os.path.exists(db_path):
        print("Does not exist.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n--- SUPPLIERS ---")
    cursor.execute("SELECT id, company_name, user_id FROM suppliers")
    suppliers = cursor.fetchall()
    for s in suppliers:
        print(f"Supplier ID: {s[0]}, Name: {s[1]}, User ID: {s[2]}")
        print("Linked Shops:")
        cursor.execute("SELECT shop_id FROM supplier_shops WHERE supplier_id=?", (s[0],))
        shops = cursor.fetchall()
        for shop in shops:
            cursor.execute("SELECT id, name FROM shops WHERE id=?", (shop[0],))
            shop_data = cursor.fetchone()
            if shop_data:
                print(f"  - Shop ID: {shop_data[0]}, Name: {shop_data[1]}")
            else:
                print(f"  - Shop ID: {shop[0]} (NOT FOUND IN SHOPS TABLE)")
        
        print("Catalog Items:")
        cursor.execute("SELECT sku, name, base_price FROM supplier_catalog WHERE supplier_id=?", (s[0],))
        catalog = cursor.fetchall()
        for item in catalog:
            print(f"  - SKU: {item[0]}, Name: {item[1]}, Price: {item[2]}")
        print("-" * 20)

    print("\n--- ALL SHOPS ---")
    cursor.execute("SELECT id, name, owner_id FROM shops")
    shops = cursor.fetchall()
    for shop in shops:
        print(f"Shop ID: {shop[0]}, Name: {shop[1]}, Owner ID: {shop[2]}")

    print("\n--- SUPPLY REQUESTS ---")
    cursor.execute("SELECT id, shop_id, product_id, status FROM supply_requests")
    requests = cursor.fetchall()
    for r in requests:
        cursor.execute("SELECT name FROM shops WHERE id=?", (r[1],))
        shop_name = cursor.fetchone()
        shop_name = shop_name[0] if shop_name else "Unknown"
        
        cursor.execute("SELECT name, sku FROM products WHERE id=?", (r[2],))
        product_data = cursor.fetchone()
        product_name = product_data[0] if product_data else "Unknown"
        product_sku = product_data[1] if product_data else "Unknown"
        
        print(f"Request ID: {r[0]}, Shop: {shop_name} (ID: {r[1]}), Product: {product_name} (ID: {r[2]}, SKU: {product_sku}), Status: {r[3]}")
    
    conn.close()

check_db('instance/inventory.db')
check_db('Backend/instance/inventory.db')
