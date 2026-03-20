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
            # Drop existing table to ensure clean start with new columns
            cursor.execute("DROP TABLE IF EXISTS product_unit_options")
            
            # Create product_unit_options table with selling_price, cost_price, and stock fields
            cursor.execute("""
                CREATE TABLE product_unit_options (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    unit_type VARCHAR(20) NOT NULL,
                    unit_value FLOAT NOT NULL,
                    selling_price FLOAT NOT NULL,
                    cost_price FLOAT,
                    stock_quantity INTEGER DEFAULT 0,
                    reorder_level INTEGER DEFAULT 10,
                    restock_quantity INTEGER DEFAULT 50,
                    FOREIGN KEY (product_id) REFERENCES products(id)
                )
            """)
            print("Table 'product_unit_options' recreated with stock fields.")

            # Add unit_type and unit_value to sale_items
            try:
                cursor.execute("ALTER TABLE sale_items ADD COLUMN unit_type VARCHAR(20)")
                print("Column 'unit_type' added to 'sale_items'.")
            except sqlite3.OperationalError:
                print("Column 'unit_type' already exists in 'sale_items'.")

            try:
                cursor.execute("ALTER TABLE sale_items ADD COLUMN unit_value FLOAT")
                print("Column 'unit_value' added to 'sale_items'.")
            except sqlite3.OperationalError:
                print("Column 'unit_value' already exists in 'sale_items'.")

            # Add unit_type and unit_value to transactions
            try:
                cursor.execute("ALTER TABLE transactions ADD COLUMN unit_type VARCHAR(20)")
                print("Column 'unit_type' added to 'transactions'.")
            except sqlite3.OperationalError:
                print("Column 'unit_type' already exists in 'transactions'.")

            try:
                cursor.execute("ALTER TABLE transactions ADD COLUMN unit_value FLOAT")
                print("Column 'unit_value' added to 'transactions'.")
            except sqlite3.OperationalError:
                print("Column 'unit_value' already exists in 'transactions'.")

            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Error during migration: {e}")
        finally:
            conn.close()
    else:
        print(f"Database not found at {db_path}")
