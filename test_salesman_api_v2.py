import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Salesman, Shop, Transaction, db
from datetime import date
from sqlalchemy import func

app = create_app()
with app.app_context():
    print("--- Testing Salesman API Logic ---")
    owner_user_id = 1
    shop = Shop.query.filter_by(owner_id=owner_user_id).first()
    if not shop:
        print("Error: No shop found for owner ID 1")
    else:
        print(f"Shop: {shop.name} (ID: {shop.id})")
        salesmen = Salesman.query.filter_by(shop_id=shop.id).all()
        print(f"Salesmen found: {len(salesmen)}")
        for s in salesmen:
            today = date.today()
            # Test queries that were failing
            try:
                daily_qty = db.session.query(func.sum(Transaction.quantity)).filter(
                    Transaction.salesman_id == s.id,
                    Transaction.transaction_type == 'SALE',
                    func.date(Transaction.date) == today
                ).scalar() or 0
                
                total_incentives = db.session.query(func.sum(Transaction.incentive_amount)).filter(
                    Transaction.salesman_id == s.id,
                    Transaction.transaction_type == 'SALE'
                ).scalar() or 0.0
                
                print(f"  Salesman: {s.name}")
                print(f"    Daily Qty: {daily_qty}")
                print(f"    Incentives: {total_incentives}")
            except Exception as e:
                print(f"  Error querying for salesman {s.name}: {e}")
    print("--- Test End ---")
