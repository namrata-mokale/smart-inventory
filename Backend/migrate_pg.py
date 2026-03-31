import os
import psycopg2
from urllib.parse import urlparse

def migrate():
    # Get database URL from environment variable
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("ERROR: DATABASE_URL not found in environment")
        return

    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # 1. Check and add birthday_discount_applied to monthly_ration_orders
        print("Checking monthly_ration_orders table...")
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='monthly_ration_orders' AND column_name='birthday_discount_applied';
        """)
        if not cur.fetchone():
            print("Adding birthday_discount_applied to monthly_ration_orders...")
            cur.execute("ALTER TABLE monthly_ration_orders ADD COLUMN birthday_discount_applied BOOLEAN DEFAULT FALSE;")
        
        # 2. Check and add birthday_discount_applied to sales
        print("Checking sales table...")
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='sales' AND column_name='birthday_discount_applied';
        """)
        if not cur.fetchone():
            print("Adding birthday_discount_applied to sales...")
            cur.execute("ALTER TABLE sales ADD COLUMN birthday_discount_applied BOOLEAN DEFAULT FALSE;")

        conn.commit()
        print("Migration completed successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
