import sqlite3
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def migrate():
    # 1. Try to get DATABASE_URL for PostgreSQL
    db_url = os.environ.get('DATABASE_URL')
    
    if db_url and db_url.startswith('postgres'):
        print("Detected PostgreSQL database. Attempting migration via psycopg2...")
        try:
            import psycopg2
            # Handle potential 'postgres://' vs 'postgresql://' issue
            if db_url.startswith('postgres://'):
                db_url = db_url.replace('postgres://', 'postgresql://', 1)
            
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor()
            
            tables_to_fix = ['supply_requests', 'supplier_bills', 'supplier_quotes']
            for table in tables_to_fix:
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN expiry_date DATE")
                    print(f"Added 'expiry_date' column to '{table}' (PostgreSQL).")
                except Exception as e:
                    conn.rollback()
                    if 'already exists' in str(e):
                        print(f"Column 'expiry_date' already exists in '{table}'.")
                    else:
                        print(f"Error migrating {table}: {e}")
                else:
                    conn.commit()
            conn.close()
            print("PostgreSQL migration completed.")
        except ImportError:
            print("psycopg2 not installed. Cannot migrate PostgreSQL automatically.")
            print("Please run these SQL commands manually on your Neon console:")
            print("ALTER TABLE supply_requests ADD COLUMN expiry_date DATE;")
            print("ALTER TABLE supplier_bills ADD COLUMN expiry_date DATE;")
            print("ALTER TABLE supplier_quotes ADD COLUMN expiry_date DATE;")
        except Exception as e:
            print(f"PostgreSQL connection error: {e}")
    
    # 2. Always try SQLite migration for local environment
    db_paths = [
        os.path.join('Backend', 'instance', 'inventory.db'),
        os.path.join('instance', 'inventory.db'),
        'inventory.db'
    ]
    
    for db_path in db_paths:
        if os.path.exists(db_path):
            print(f"\nMigrating local SQLite database at {db_path}...")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            tables_to_fix = ['supply_requests', 'supplier_bills', 'supplier_quotes']
            for table in tables_to_fix:
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN expiry_date DATE")
                    print(f"Added 'expiry_date' column to '{table}' (SQLite).")
                except sqlite3.OperationalError as e:
                    if 'duplicate column name' in str(e).lower():
                        print(f"Column 'expiry_date' already exists in '{table}'.")
                    else:
                        print(f"Error migrating {table}: {e}")
            
            conn.commit()
            conn.close()
            print("SQLite migration completed.")

if __name__ == "__main__":
    migrate()
