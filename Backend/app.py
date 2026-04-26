# Smart Inventory Backend - Render Deployment Trigger
from flask import Flask, request, make_response, jsonify
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
    
    # SIMPLIFIED CORS FOR MAXIMUM RELIABILITY
    from flask_cors import CORS
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    
    # RUN MIGRATIONS ON STARTUP (Autonomously handle Neon/SQLite column updates)
    with app.app_context():
        try:
            from sqlalchemy import text
            print("INFO: Checking for missing columns and tables...")
            
            # 1. Ensure columns exist in relevant tables
            migration_tasks = [
                ('supply_requests', 'expiry_date', 'DATE'),
                ('supplier_bills', 'expiry_date', 'DATE'),
                ('supplier_bills', 'shop_unit_price', 'FLOAT'),
                ('supplier_bills', 'gst_rate', 'FLOAT DEFAULT 0.18'),
                ('supplier_quotes', 'expiry_date', 'DATE'),
                ('supplier_quotes', 'gst_rate', 'FLOAT DEFAULT 0.18'),
                ('transactions', 'gst_amount', 'FLOAT DEFAULT 0.0'),
                ('transactions', 'total_amount', 'FLOAT'),
                ('customers', 'birthday_reward_used', 'BOOLEAN DEFAULT FALSE')
            ]
            
            for table, column, col_type in migration_tasks:
                try:
                    # Check if column already exists
                    db.session.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
                except Exception:
                    db.session.rollback()
                    print(f"INFO: Adding '{column}' column to '{table}'...")
                    is_postgres = 'postgresql' in str(db.engine.url)
                    db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    db.session.commit()
                    print(f"SUCCESS: Added '{column}' to '{table}'")

            # 1.5 Sync existing GST rates (Fix legacy 18% default)
            print("INFO: Syncing legacy GST rates...")
            from models import SupplierQuote, SupplierBill, Transaction
            
            # Quotes
            db.session.execute(text("UPDATE supplier_quotes SET gst_rate = ROUND(gst_amount / total, 4) WHERE total > 0 AND gst_rate = 0.18"))
            # Bills
            db.session.execute(text("UPDATE supplier_bills SET gst_rate = ROUND(gst_amount / total, 4) WHERE total > 0 AND gst_rate = 0.18"))
            # Transactions
            db.session.execute(text("UPDATE transactions SET gst_rate = ROUND(gst_amount / (quantity * unit_price), 4) WHERE (quantity * unit_price) > 0 AND gst_rate = 0.18"))
            
            db.session.commit()
            print("SUCCESS: Legacy GST rates synchronized.")

            # 2. Ensure product_batches table exists
            try:
                db.session.execute(text("SELECT id FROM product_batches LIMIT 1"))
            except Exception:
                db.session.rollback()
                print("INFO: Creating 'product_batches' table...")
                is_postgres = 'postgresql' in str(db.engine.url)
                if is_postgres:
                    db.session.execute(text("""
                        CREATE TABLE product_batches (
                            id SERIAL PRIMARY KEY,
                            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                            unit_option_id INTEGER REFERENCES product_unit_options(id) ON DELETE CASCADE,
                            quantity INTEGER DEFAULT 0,
                            expiry_date DATE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """))
                else:
                    db.session.execute(text("""
                        CREATE TABLE product_batches (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            product_id INTEGER NOT NULL,
                            unit_option_id INTEGER,
                            quantity INTEGER DEFAULT 0,
                            expiry_date DATE,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                            FOREIGN KEY (unit_option_id) REFERENCES product_unit_options(id) ON DELETE CASCADE
                        )
                    """))
                db.session.commit()
                print("SUCCESS: Created 'product_batches' table")
                
                # Migrate existing stock to batches
                print("INFO: Migrating existing stock to batches...")
                # From unit options
                db.session.execute(text("""
                    INSERT INTO product_batches (product_id, unit_option_id, quantity)
                    SELECT product_id, id, stock_quantity FROM product_unit_options WHERE stock_quantity > 0
                """))
                db.session.execute(text("""
                    INSERT INTO product_batches (product_id, quantity, expiry_date)
                    SELECT id, stock_quantity, expiry_date FROM products 
                    WHERE stock_quantity > 0 AND id NOT IN (SELECT product_id FROM product_unit_options)
                """))
                db.session.commit()
                print("SUCCESS: Stock migration to batches completed.")

            # NEW: Column verification for Birthday Discounts
            try:
                print("INFO: Checking for birthday_discount_applied columns...")
                # 1. monthly_ration_orders
                db.session.execute(text("ALTER TABLE monthly_ration_orders ADD COLUMN IF NOT EXISTS birthday_discount_applied BOOLEAN DEFAULT FALSE;"))
                # 2. sales
                db.session.execute(text("ALTER TABLE sales ADD COLUMN IF NOT EXISTS birthday_discount_applied BOOLEAN DEFAULT FALSE;"))
                db.session.commit()
                print("SUCCESS: Birthday discount columns verified.")
            except Exception as col_err:
                db.session.rollback()
                print(f"WARNING: Could not auto-add columns: {col_err}")

            print("INFO: All database migrations verified.")
        except Exception as me:
            db.session.rollback()
            print(f"CRITICAL: Database migration failed: {me}")
            import traceback
            traceback.print_exc()
    
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Accept'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,PATCH,OPTIONS'
            response.status_code = 204
            return response

    @app.after_request
    def add_cors_headers(response):
        # Ensure all outgoing responses have CORS headers, regardless of middleware status
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Accept'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,PATCH,OPTIONS'
        return response

    # Global error handler to ensure CORS headers are sent even on 500 errors
    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(f"ERROR: Backend crash on {request.method if request else 'unknown'} {request.url if request else 'unknown'}")
        traceback.print_exc()
        
        # Determine error message
        msg = str(e)
        status_code = 500
        
        # Check if it's a standard HTTP exception from Flask/Werkzeug
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            msg = e.description
            status_code = e.code

        response = jsonify({"message": f"Backend Error: {msg}"})
        response.status_code = status_code
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Requested-With,Accept'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,PATCH,OPTIONS'
        return response

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
        from models import Product, ExpiredProduct, ProductBatch
        today = date.today()
        
        # Scan individual batches for expiry (NEW BATCH-BASED LOGIC)
        expired_batches = ProductBatch.query.filter(ProductBatch.expiry_date != None, ProductBatch.expiry_date <= today).all()
        
        for batch in expired_batches:
            product = Product.query.get(batch.product_id)
            if product:
                # Add to ExpiredProduct table (only for this batch's quantity)
                # Check if an entry for this product + expiry date already exists to merge or avoid duplicate
                exists = ExpiredProduct.query.filter_by(
                    product_id=product.id, 
                    shop_id=product.shop_id, 
                    expiry_date=batch.expiry_date
                ).first()
                
                if not exists:
                    archived = ExpiredProduct(
                        product_id=product.id,
                        shop_id=product.shop_id,
                        name=product.name,
                        sku=product.sku,
                        category=product.category,
                        expiry_date=batch.expiry_date,
                        shelf_life_days=product.shelf_life_days,
                        stock_at_expiry=batch.quantity
                    )
                    db.session.add(archived)
                else:
                    # Increment stock_at_expiry if already exists for this date
                    exists.stock_at_expiry += batch.quantity
                
                # Deduct expired quantity from the product's main stock
                product.stock_quantity -= batch.quantity
                if product.stock_quantity < 0: product.stock_quantity = 0
                
                # If it was a variation batch, deduct from there too
                if batch.unit_option_id:
                    from models import ProductUnitOption
                    opt = ProductUnitOption.query.get(batch.unit_option_id)
                    if opt:
                        opt.stock_quantity -= batch.quantity
                        if opt.stock_quantity < 0: opt.stock_quantity = 0
                
                # Archive the product ONLY if total stock hits zero
                if product.stock_quantity <= 0:
                    product.is_archived = True
                
                # Delete the expired batch record
                db.session.delete(batch)
                print(f"DEBUG: Processed expired batch for {product.name} (Qty: {batch.quantity}, Expiry: {batch.expiry_date})")
        
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
