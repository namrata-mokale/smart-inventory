import sqlite3
import os
import random
import string

db_path = os.path.join('Backend', 'instance', 'inventory.db')
if not os.path.exists(db_path):
    # Try another path just in case
    db_path = os.path.join('instance', 'inventory.db')
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
    else:
        conn = sqlite3.connect(db_path)
else:
    conn = sqlite3.connect(db_path)

if 'conn' in locals():
    cursor = conn.cursor()
    
    # 1. Check if customers table has columns
    cursor.execute("PRAGMA table_info(customers);")
    cols = [c[1] for c in cursor.fetchall()]
    
    if 'customer_id_code' not in cols:
        print("Adding customer_id_code column...")
        cursor.execute("ALTER TABLE customers ADD COLUMN customer_id_code VARCHAR(50);")
    if 'address' not in cols:
        print("Adding address column...")
        cursor.execute("ALTER TABLE customers ADD COLUMN address VARCHAR(200);")
    if 'email' not in cols:
        print("Adding email column...")
        cursor.execute("ALTER TABLE customers ADD COLUMN email VARCHAR(120);")
    if 'user_id' not in cols:
        print("Adding user_id column...")
        cursor.execute("ALTER TABLE customers ADD COLUMN user_id INTEGER;")
    if 'loyalty_points' not in cols:
        print("Adding loyalty_points column...")
        cursor.execute("ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;")

    # 2. Check salesmen table
    cursor.execute("PRAGMA table_info(salesmen);")
    salesman_cols = [c[1] for c in cursor.fetchall()]
    
    if 'email' not in salesman_cols:
        print("Adding salesman email column...")
        cursor.execute("ALTER TABLE salesmen ADD COLUMN email VARCHAR(120);")
    if 'gender' not in salesman_cols:
        print("Adding salesman gender column...")
        cursor.execute("ALTER TABLE salesmen ADD COLUMN gender VARCHAR(20);")
    if 'account_number' not in salesman_cols:
        print("Adding salesman account_number column...")
        cursor.execute("ALTER TABLE salesmen ADD COLUMN account_number VARCHAR(50);")
    if 'user_id' not in salesman_cols:
        print("Adding salesman user_id column...")
        cursor.execute("ALTER TABLE salesmen ADD COLUMN user_id INTEGER;")
    if 'incentive_rate' not in salesman_cols:
        print("Adding salesman incentive_rate column...")
        cursor.execute("ALTER TABLE salesmen ADD COLUMN incentive_rate FLOAT DEFAULT 2.0;")

    # 3. Populate missing IDs and placeholder addresses
    cursor.execute("SELECT id, name, customer_id_code, address FROM customers;")
    rows = cursor.fetchall()
    
    for row in rows:
        cust_db_id = row[0]
        name = row[1]
        id_code = row[2]
        addr = row[3]
        
        updates = []
        params = []
        
        if not id_code:
            new_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            updates.append("customer_id_code = ?")
            params.append(new_id)
            print(f"Assigning ID {new_id} to {name}")
            
        if not addr:
            updates.append("address = ?")
            params.append("Not provided")
            print(f"Assigning placeholder address to {name}")
            
        if updates:
            sql = f"UPDATE customers SET {', '.join(updates)} WHERE id = ?"
            params.append(cust_db_id)
            cursor.execute(sql, params)
            
    conn.commit()
    print("Migration complete.")
    conn.close()
