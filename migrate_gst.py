import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import db
from sqlalchemy import text

def migrate():
    app = create_app()
    with app.app_context():
        print("Checking database schema for GST rate columns...")
        try:
            # Table list to check
            tables = ['supplier_quotes', 'supplier_bills', 'transactions']
            
            for table in tables:
                print(f"\nChecking {table}...")
                columns = [row[1] for row in db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()]
                
                if 'gst_rate' not in columns:
                    print(f"Adding gst_rate to {table}...")
                    db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN gst_rate FLOAT DEFAULT 0.18"))
                else:
                    print(f"gst_rate already exists in {table}")
            
            db.session.commit()
            print("\nGST Rate migration completed successfully.")
            
        except Exception as e:
            db.session.rollback()
            print(f"Migration error: {e}")

if __name__ == '__main__':
    migrate()
