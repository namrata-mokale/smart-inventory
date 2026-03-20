import sqlite3
import os

db_paths = [
    os.path.join('Backend', 'instance', 'inventory.db'),
    os.path.join('instance', 'inventory.db')
]

for db_path in db_paths:
    if os.path.exists(db_path):
        print(f"Migrating database at {db_path}...")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        try:
            # Create monthly_ration_orders table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monthly_ration_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    shop_id INTEGER NOT NULL,
                    total_amount FLOAT NOT NULL,
                    payment_method VARCHAR(20) NOT NULL,
                    payment_status VARCHAR(20) DEFAULT 'pending',
                    delivery_status VARCHAR(20) DEFAULT 'pending',
                    delivery_address VARCHAR(200) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id),
                    FOREIGN KEY (shop_id) REFERENCES shops(id)
                )
            """)
            print("Table 'monthly_ration_orders' created.")

            # Create monthly_ration_order_items table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monthly_ration_order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    product_name VARCHAR(100) NOT NULL,
                    quantity FLOAT NOT NULL,
                    unit VARCHAR(20) NOT NULL,
                    price_at_order FLOAT NOT NULL,
                    FOREIGN KEY (order_id) REFERENCES monthly_ration_orders(id),
                    FOREIGN KEY (product_id) REFERENCES products(id)
                )
            """)
            print("Table 'monthly_ration_order_items' created.")

            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Error during migration: {e}")
        finally:
            conn.close()
    else:
        print(f"Database not found at {db_path}")
