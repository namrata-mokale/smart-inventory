import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Transaction, Shop, Salesman
from flask_jwt_extended import create_access_token

app = create_app()
with app.app_context():
    # Simulate a salesman login
    # Let's find a salesman first
    salesman = Salesman.query.first()
    if not salesman:
        print("No salesman found in DB")
    else:
        print(f"Testing with salesman: {salesman.name} (ID: {salesman.id}, User ID: {salesman.user_id})")
        
        # Mock current_user identity
        current_user = {'id': salesman.user_id, 'role': 'salesman'}
        
        try:
            # Test get_shop_id_for_user logic
            shop_id = salesman.shop_id
            print(f"Shop ID: {shop_id}")
            
            # Test Transaction query
            tx = Transaction.query.filter_by(shop_id=shop_id, transaction_type='SALE').all()
            print(f"Found {len(tx)} transactions")
            
            # Test history logic
            for t in tx:
                print(f"Tx: {t.id}, Date: {t.date}, Salesman: {t.salesman.name if t.salesman else 'None'}")
                
            print("All tests passed!")
        except Exception as e:
            import traceback
            print(f"Error: {e}")
            traceback.print_exc()
