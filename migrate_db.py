import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import db
from sqlalchemy import text

def migrate():
    app = create_app()
    with app.app_context():
        print("Checking database schema...")
        try:
            # Check supply_requests table
            print("\nMigrating supply_requests...")
            columns = [row[1] for row in db.session.execute(text("PRAGMA table_info(supply_requests)")).fetchall()]
            
            if 'unit_type' not in columns:
                print("Adding unit_type to supply_requests...")
                db.session.execute(text("ALTER TABLE supply_requests ADD COLUMN unit_type VARCHAR(20)"))
            
            if 'unit_value' not in columns:
                print("Adding unit_value to supply_requests...")
                db.session.execute(text("ALTER TABLE supply_requests ADD COLUMN unit_value FLOAT"))
                
            # Check supplier_bills table
            print("\nMigrating supplier_bills...")
            columns_bills = [row[1] for row in db.session.execute(text("PRAGMA table_info(supplier_bills)")).fetchall()]
            
            if 'unit_type' not in columns_bills:
                print("Adding unit_type to supplier_bills...")
                db.session.execute(text("ALTER TABLE supplier_bills ADD COLUMN unit_type VARCHAR(20)"))
            
            if 'unit_value' not in columns_bills:
                print("Adding unit_value to supplier_bills...")
                db.session.execute(text("ALTER TABLE supplier_bills ADD COLUMN unit_value FLOAT"))
            
            db.session.commit()
            print("\nDatabase migration completed successfully.")
            
        except Exception as e:
            db.session.rollback()
            print(f"Migration error: {e}")

if __name__ == '__main__':
    migrate()
