import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import db, Product, ExpiredProduct, Shop, User
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    # Setup: Create a shop and an expired product
    user = User.query.filter_by(username='test_owner_v8').first()
    if not user:
        user = User(username='test_owner_v8', role='shop_owner')
        db.session.add(user)
        db.session.commit()
    
    shop = Shop.query.filter_by(owner_id=user.id).first()
    if not shop:
        shop = Shop(name='Test Shop V8', owner_id=user.id)
        db.session.add(shop)
        db.session.commit()

    # Create an expired product
    product = Product.query.filter_by(sku='09_test', shop_id=shop.id).first()
    if not product:
        product = Product(
            sku='09_test', name='abc_test', category='General',
            cost_price=5.0, selling_price=9.0, stock_quantity=28,
            expiry_date=datetime.now().date() - timedelta(days=1),
            shop_id=shop.id, is_archived=True
        )
        db.session.add(product)
        db.session.commit()
    
    # Add to ExpiredProduct table
    expired_entry = ExpiredProduct.query.filter_by(product_id=product.id).first()
    if not expired_entry:
        expired_entry = ExpiredProduct(
            product_id=product.id, shop_id=shop.id,
            name='abc_test', sku='09_test', category='General',
            expiry_date=product.expiry_date, stock_at_expiry=28
        )
        db.session.add(expired_entry)
        db.session.commit()

    print(f"Initial state: Product archived={product.is_archived}, ExpiredProduct entries={ExpiredProduct.query.filter_by(product_id=product.id).count()}")

    # Simulate restocking
    product.is_archived = False
    product.expiry_date = datetime.now().date() + timedelta(days=30)
    product.stock_quantity = 38
    db.session.commit()
    
    # Simulate the cleanup logic from get_products
    today = datetime.now().date()
    products = Product.query.filter_by(shop_id=shop.id, is_archived=False).all()
    for p in list(products):
        if p.expiry_date and p.expiry_date <= today:
            pass
        else:
            ExpiredProduct.query.filter_by(product_id=p.id, shop_id=p.shop_id).delete()
            if p.sku:
                ExpiredProduct.query.filter_by(sku=p.sku, shop_id=p.shop_id).delete()
            db.session.commit()

    print(f"After restock & cleanup: Product archived={product.is_archived}, ExpiredProduct entries={ExpiredProduct.query.filter_by(product_id=product.id).count()}")
