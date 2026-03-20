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
            # Create monthly_rations table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monthly_rations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    shop_id INTEGER NOT NULL,
                    status VARCHAR(20) DEFAULT 'draft',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (customer_id) REFERENCES customers(id),
                    FOREIGN KEY (shop_id) REFERENCES shops(id)
                )
            """)
            print("Table 'monthly_rations' created.")

            # Create monthly_ration_items table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monthly_ration_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ration_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity FLOAT NOT NULL,
                    unit VARCHAR(20) NOT NULL,
                    FOREIGN KEY (ration_id) REFERENCES monthly_rations(id),
                    FOREIGN KEY (product_id) REFERENCES products(id)
                )
            """)
            print("Table 'monthly_ration_items' created.")

            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Error during migration: {e}")
        finally:
            conn.close()
    else:
        print(f"Database not found at {db_path}")
