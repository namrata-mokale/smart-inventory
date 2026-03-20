from app import create_app
from models import Product, Customer, Shop
from services.notification_service import send_email

app = create_app()
with app.app_context():
    # 1. Find Product
    sku = "0112"
    product = Product.query.filter_by(sku=sku).first()
    
    if not product:
        print(f"X Product with SKU {sku} NOT FOUND.")
        # Fallback: List all products to help user
        print("Available SKUs:")
        for p in Product.query.all():
            print(f"- {p.sku}: {p.name} (ID: {p.id})")
    else:
        print(f"V Found Product: {product.name} (ID: {product.id}, Shop ID: {product.shop_id})")
        
        # 2. Find Customers
        customers = Customer.query.filter_by(shop_id=product.shop_id).all()
        print(f"Found {len(customers)} customers linked to Shop ID {product.shop_id}")
        
        if not customers:
            print("! No customers found for this shop. Add a customer first!")
        
        # 3. Send Emails
        for c in customers:
            print(f"Sending email to {c.email}...")
            subject = f"TEST FLASH SALE: {product.name}"
            body = f"This is a test email for {product.name} (SKU: {sku}). 20% OFF!"
            
            try:
                success = send_email(c.email, subject, body)
                if success:
                    print(f"V Email sent to {c.email}")
                else:
                    print(f"X Failed to send email to {c.email}")
            except Exception as e:
                print(f"X Exception: {e}")
