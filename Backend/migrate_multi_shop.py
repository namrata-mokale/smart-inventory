from app import create_app
from models import db
import os

app = create_app()
with app.app_context():
    # SQLite doesn't support easy ALTER TABLE for dropping columns or adding FKs with constraints.
    # We will use the migration-like approach: Recreate the tables correctly.
    
    print("Fixing database schema for multiple shops and DOB...")
    
    try:
        # 1. Rename old customers table
        db.session.execute(db.text("ALTER TABLE customers RENAME TO customers_old"))
        
        # 2. Create new customers table with dob and without shop_id
        db.session.execute(db.text("""
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id_code VARCHAR(50) UNIQUE,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(120),
                address VARCHAR(200),
                dob VARCHAR(20),
                user_id INTEGER,
                loyalty_points INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """))
        
        # 3. Copy data from old to new (mapping old shop_id to the new many-to-many table later)
        db.session.execute(db.text("""
            INSERT INTO customers (id, customer_id_code, name, phone, email, address, user_id, loyalty_points, created_at)
            SELECT id, customer_id_code, name, phone, email, address, user_id, loyalty_points, created_at FROM customers_old
        """))
        
        # 4. Create the association table for many-to-many relationship
        db.session.execute(db.text("""
            CREATE TABLE IF NOT EXISTS customer_shops (
                customer_id INTEGER NOT NULL,
                shop_id INTEGER NOT NULL,
                PRIMARY KEY (customer_id, shop_id),
                FOREIGN KEY(customer_id) REFERENCES customers(id),
                FOREIGN KEY(shop_id) REFERENCES shops(id)
            )
        """))
        
        # 5. Migrate existing shop_id links from old table to association table
        db.session.execute(db.text("""
            INSERT INTO customer_shops (customer_id, shop_id)
            SELECT id, shop_id FROM customers_old WHERE shop_id IS NOT NULL
        """))
        
        # 6. Drop old customers table
        db.session.execute(db.text("DROP TABLE customers_old"))
        
        # 7. Add customer_id to transactions table if missing
        # Check if column exists first
        columns = db.session.execute(db.text("PRAGMA table_info(transactions)")).fetchall()
        has_customer_id = any(col[1] == 'customer_id' for col in columns)
        
        if not has_customer_id:
            db.session.execute(db.text("ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)"))
            print("Added customer_id column to transactions table.")
        
        db.session.commit()
        print("Database schema updated successfully!")
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating schema: {e}")
        import traceback
        traceback.print_exc()
