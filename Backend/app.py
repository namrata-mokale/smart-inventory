from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from config import Config
from models import db
from dotenv import load_dotenv
import os
import sys
from threading import Thread
import time
from datetime import date

# Load environment variables from .env file
load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize Extensions
    db.init_app(app)
    Migrate(app, db)
    
    # PERMISSIVE CORS FOR ALL ENVIRONMENTS
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
        }
    })
    
    JWTManager(app)
    
    # IMPORT MODELS TO ENSURE THEY ARE REGISTERED WITH METADATA
    from models import User, Shop, Supplier, Salesman, Product, Transaction, SupplyRequest, SupplierBill, SupplierQuote, ExpiredProduct, Customer, BirthdayOffer
    
    # Register Blueprints
    from routes.auth_routes import auth_bp
    from routes.inventory_routes import inventory_bp
    from routes.admin_routes import admin_bp
    from routes.supplier_routes import supplier_bp
    from routes.analytics_routes import analytics_bp
    from routes.customer_routes import customer_bp
    from routes.billing_routes import billing_bp
    from routes.salesman_routes import salesman_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(supplier_bp, url_prefix='/api/supplier')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(customer_bp, url_prefix='/api/customers')
    app.register_blueprint(billing_bp, url_prefix='/api/billing')
    app.register_blueprint(salesman_bp, url_prefix='/api/salesman')
    
    @app.route('/')
    def home():
        return "Backend is running! Please access the frontend (usually at http://localhost:5173)."
    
    def expire_scan_once():
        from models import Product, ExpiredProduct
        today = date.today()
        products = Product.query.filter(Product.expiry_date != None).all()
        for p in products:
            if p.expiry_date and p.expiry_date <= today:
                exists = ExpiredProduct.query.filter_by(product_id=p.id).first()
                if not exists:
                    archived = ExpiredProduct(
                        product_id=p.id,
                        shop_id=p.shop_id,
                        name=p.name,
                        sku=p.sku,
                        category=p.category,
                        expiry_date=p.expiry_date,
                        shelf_life_days=p.shelf_life_days,
                        stock_at_expiry=p.stock_quantity
                    )
                    db.session.add(archived)
                p.is_archived = True
        db.session.commit()

    def auto_accept_quotes_once():
        from datetime import datetime, timedelta
        from models import SupplyRequest, SupplierQuote, SupplierBill
        cutoff = datetime.utcnow() - timedelta(hours=24)
        # Find requests awaiting approval or with quotes received
        candidates = SupplyRequest.query.filter(SupplyRequest.status.in_(['Awaiting Approval', 'Quotes Received'])).all()
        for r in candidates:
            # If any quote exists and the first quote is older than cutoff, auto-accept cheapest
            quotes = SupplierQuote.query.filter_by(supply_request_id=r.id).all()
            if not quotes:
                continue
            oldest = min(q.created_at for q in quotes)
            if oldest > cutoff:
                continue
            # Choose cheapest total
            best = min(quotes, key=lambda q: q.total)
            # Mark all others rejected
            for q in quotes:
                q.status = 'Rejected'
            best.status = 'Accepted'
            bill = SupplierBill(
                shop_id=r.shop_id,
                supplier_id=best.supplier_id,
                product_id=best.product_id,
                supply_request_id=r.id,
                quantity=r.quantity_needed,
                unit_type=r.unit_type,
                unit_value=r.unit_value,
                unit_price=best.unit_price,
                discount_percent=best.discount_percent,
                total=best.total,
                gst_amount=best.gst_amount,
                grand_total=best.grand_total,
                status='Pending'
            )
            db.session.add(bill)
            r.status = 'Approved'
        db.session.commit()

    def process_payment_deadlines_once():
        from datetime import datetime, timedelta
        from models import SupplierBill, SupplyRequest, Product, db
        from services.notification_service import send_email
        
        # 3 business days logic (simple 72 hours for demo, could be refined for weekends)
        deadline = datetime.utcnow() - timedelta(days=3)
        
        # Find bills that are 'Awaiting Payment' and past the deadline
        unpaid_bills = SupplierBill.query.filter(
            SupplierBill.status == 'Awaiting Payment',
            SupplierBill.date_delivered <= deadline
        ).all()
        
        for bill in unpaid_bills:
            bill.status = 'Failed' # Delivery Failed due to non-payment
            
            # Update the original request to Failed/Restock Needed
            req = SupplyRequest.query.get(bill.supply_request_id)
            if req:
                req.status = 'Delivery Failed'
                
                # REVERSE THE STOCK UPDATE (since it was never paid/delivered successfully)
                product = Product.query.get(bill.product_id)
                if product:
                    product.stock_quantity -= bill.quantity
                    if product.stock_quantity < 0: product.stock_quantity = 0

            # Notify Supplier
            if bill.supplier and bill.supplier.user and bill.supplier.user.email:
                try:
                    send_email(bill.supplier.user.email, 
                               "Alert: Delivery Failed (Payment Overdue)", 
                               f"Order for {bill.product_id} to Shop {bill.shop_id} has been marked as Failed because payment was not received within 3 business days.")
                except Exception: pass
            
            # Notify Shop Owner
            if bill.shop and bill.shop.owner and bill.shop.owner.email:
                try:
                    send_email(bill.shop.owner.email, 
                               "Alert: Order Cancelled (Payment Denial)", 
                               f"Your order for {bill.product_id} has been cancelled because payment was not completed within the 3-day window. Stock has been reversed.")
                except Exception: pass
        
        db.session.commit()

    def process_birthday_notifications_once():
        from models import Customer
        from services.notification_service import send_birthday_wish
        
        # Find all customers and try to send birthday wishes
        customers = Customer.query.all()
        for c in customers:
            send_birthday_wish(c)

    def start_expiry_background(app):
        def job():
            with app.app_context():
                while True:
                    try:
                        expire_scan_once()
                        auto_accept_quotes_once()
                        process_payment_deadlines_once()
                        process_birthday_notifications_once()
                    except Exception as e:
                        print(f"Background job error: {e}")
                        pass
                    time.sleep(60 * 60 * 12)
        t = Thread(target=job, daemon=True)
        t.start()

    start_expiry_background(app)
    
    # Initialize database tables if they don't exist
    with app.app_context():
        try:
            db.create_all()
            print("Database tables initialized (PostgreSQL/SQLite).")
        except Exception as e:
            print(f"Error during database initialization: {e}")
            
    return app

if __name__ == '__main__':
    try:
        print("Starting Flask app...")
        app = create_app()
        print("App instance created.")
        
        with app.app_context():
            print("Syncing database models...")
            db.create_all()
            print("Database ready.")
            
        print("Backend server is starting on http://0.0.0.0:5001")
        app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
    except Exception as e:
        print(f"CRITICAL ERROR DURING STARTUP: {e}")
        import traceback
        traceback.print_exc()
