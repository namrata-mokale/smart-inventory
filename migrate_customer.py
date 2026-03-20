import sys
import os
from sqlalchemy import text

# Set up paths
base_dir = r'c:\Users\Harshada\OneDrive\Desktop\smart_inven'
backend_dir = os.path.join(base_dir, 'Backend')
sys.path.append(backend_dir)

try:
    from app import create_app
    from models import db
    
    app = create_app()
    with app.app_context():
        print("\n--- MIGRATING CUSTOMER MODELS ---")
        
        try:
            # Monthly Ration Items
            print("Adding columns to monthly_ration_items...")
            columns = [row[1] for row in db.session.execute(text("PRAGMA table_info(monthly_ration_items)")).fetchall()]
            if 'unit_option_id' not in columns:
                db.session.execute(text("ALTER TABLE monthly_ration_items ADD COLUMN unit_option_id INTEGER"))
            if 'price' not in columns:
                db.session.execute(text("ALTER TABLE monthly_ration_items ADD COLUMN price FLOAT"))
                
            # Monthly Ration Order Items
            print("Adding columns to monthly_ration_order_items...")
            columns_orders = [row[1] for row in db.session.execute(text("PRAGMA table_info(monthly_ration_order_items)")).fetchall()]
            if 'unit_option_id' not in columns_orders:
                db.session.execute(text("ALTER TABLE monthly_ration_order_items ADD COLUMN unit_option_id INTEGER"))
            
            db.session.commit()
            print("Migration successful.")
        except Exception as e:
            db.session.rollback()
            print(f"Migration error: {e}")
            
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
