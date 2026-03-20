import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Salesman, Shop, Transaction, db
from flask_jwt_extended import create_access_token
from datetime import date

app = create_app()
with app.app_context():
    # Simulate shop owner login (User ID 1)
    # Mock current_user identity
    current_user = {'id': 1, 'role': 'shop_owner'}
    
    user_id = current_user['id']
    role = current_user['role']
    
    shop_id = None
    if role == 'shop_owner':
        shop = Shop.query.filter_by(owner_id=user_id).first()
        if shop: shop_id = shop.id
        
    print(f"Shop ID: {shop_id}")
    
    if shop_id:
        salesmen = Salesman.query.filter_by(shop_id=shop_id).all()
        print(f"Found {len(salesmen)} salesmen")
        
        result = []
        from sqlalchemy import func
        for s in salesmen:
            today = date.today()
            daily_qty = db.session.query(func.sum(Transaction.quantity)).filter(
                Transaction.salesman_id == s.id,
                Transaction.transaction_type == 'SALE',
                func.date(Transaction.date) == today
            ).scalar() or 0
            
            total_incentives = db.session.query(func.sum(Transaction.incentive_amount)).filter(
                Transaction.salesman_id == s.id,
                Transaction.transaction_type == 'SALE'
            ).scalar() or 0.0
            
            print(f"Salesman: {s.name}, Daily Qty: {daily_qty}, Incentives: {total_incentives}")
            
            result.append({
                "id": s.id,
                "name": s.name,
                "daily_sales_qty": daily_qty,
                "incentives": round(total_incentives, 2)
            })
        print("API Simulation Successful")
    else:
        print("No shop found for owner")
