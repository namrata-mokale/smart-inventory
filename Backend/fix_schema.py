import sqlite3
import os

db_path = os.path.join('instance', 'inventory.db')
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # SQLite doesn't support ALTER TABLE ... ALTER COLUMN to change NULLability easily.
    # We need to recreate the table.
    
    # 1. Rename existing table
    cursor.execute("ALTER TABLE customers RENAME TO customers_old;")
    
    # 2. Create new table with correct schema (shop_id NULLABLE)
    cursor.execute("""
    CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(120),
        shop_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        customer_id_code VARCHAR(50),
        address VARCHAR(200),
        user_id INTEGER,
        loyalty_points INTEGER DEFAULT 0,
        FOREIGN KEY(shop_id) REFERENCES shops(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)
    
    # 3. Copy data
    cursor.execute("""
    INSERT INTO customers (id, name, phone, email, shop_id, created_at, customer_id_code, address, user_id, loyalty_points)
    SELECT id, name, phone, email, shop_id, created_at, customer_id_code, address, user_id, loyalty_points FROM customers_old;
    """)
    
    # 4. Drop old table
    cursor.execute("DROP TABLE customers_old;")
    
    conn.commit()
    print("Database schema fixed successfully!")
except Exception as e:
    conn.rollback()
    print(f"Error fixing schema: {e}")
finally:
    conn.close()
