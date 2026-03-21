from flask import Blueprint, request, jsonify
from models import db, Product, Shop, Transaction, SupplyRequest, Supplier, SupplierBill, SupplierCatalog, ExpiredProduct, SupplierQuote, User, Salesman, ProductUnitOption
from services.notification_service import send_email, send_sms
from services.matching_service import find_catalog_match
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

inventory_bp = Blueprint('inventory', __name__)

def get_shop_id_for_user(current_user):
    user_id = current_user['id']
    role = current_user['role']
    
    if role == 'shop_owner':
        # Check if user owns a shop directly
        shop = Shop.query.filter_by(owner_id=user_id).first()
        if shop: return shop.id
        
        # Fallback: Check if user is linked to any shop through Salesman table (sometimes happens in setup)
        salesman = Salesman.query.filter_by(user_id=user_id).first()
        if salesman: return salesman.shop_id
        
        return current_user.get('shop_id')
    elif role == 'salesman':
        salesman = Salesman.query.filter_by(user_id=user_id).first()
        if not salesman:
            # Robust fallback: Try to find salesman by user's phone or email if not linked yet
            from models import User
            user = User.query.get(user_id)
            if user:
                salesman = Salesman.query.filter_by(phone=user.phone).first() or \
                           Salesman.query.filter_by(email=user.email).first()
                if salesman:
                    salesman.user_id = user.id
                    db.session.commit()
        
        if salesman:
            return salesman.shop_id
        return current_user.get('shop_id')
    elif role == 'admin':
        shop = Shop.query.first()
        return shop.id if shop else None
    return None

@inventory_bp.route('/transaction', methods=['POST'])
@jwt_required()
def record_transaction():
    from models import Product, Salesman, Transaction, Shop, ExpiredProduct, Customer, ProductUnitOption, BirthdayOffer
    from datetime import datetime
    
    try:
        current_user = get_jwt_identity()
        data = request.get_json()
        
        product_id = data.get('product_id')
        transaction_type = data.get('type', 'SALE')
        quantity = int(data.get('quantity', 0))
        salesman_id_code = data.get('salesman_id_code')
        scanned_qr_code = data.get('scanned_qr_code')
        unit_option_id = data.get('unit_option_id')
        
        # 1. Product Lookup
        product = Product.query.get(product_id)
        if not product:
            try:
                product = Product.query.get(int(product_id))
            except:
                pass
        
        if not product:
            return jsonify({"message": f"Product #{product_id} not found in database"}), 404

        # 2. Permissions & Shop Validation
        if current_user['role'] == 'salesman':
            salesman = Salesman.query.filter_by(user_id=current_user['id']).first()
            if not salesman or salesman.shop_id != product.shop_id:
                return jsonify({"message": "Unauthorized: Product belongs to another shop"}), 403
            if not salesman_id_code:
                salesman_id_code = salesman.salesman_id_code
        
        # 3. Sale-Specific Validation (QR Scan)
        if transaction_type == 'SALE':
            if not scanned_qr_code:
                return jsonify({"message": "Product must be scanned before selling"}), 400
            # Strict check: ignore case and whitespace
            if str(scanned_qr_code).strip().upper() != str(product.qr_code).strip().upper():
                return jsonify({"message": "Scanned code does not match this product"}), 400

        # 4. Customer Logic
        customer_data = data.get('customer')
        customer_db_id = None
        if transaction_type == 'SALE' and customer_data and customer_data.get('phone'):
            c_phone = customer_data.get('phone')
            customer_obj = Customer.query.filter_by(phone=c_phone).first()
            if not customer_obj and customer_data.get('save_profile'):
                import random, string
                unique_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                customer_obj = Customer(
                    customer_id_code=unique_id,
                    name=customer_data.get('name'),
                    phone=c_phone,
                    email=customer_data.get('email'),
                    dob=customer_data.get('dob'),
                    address=customer_data.get('address') or 'Not provided'
                )
                db.session.add(customer_obj)
                db.session.flush()
            
            if customer_obj:
                customer_db_id = customer_obj.id
                shop_obj = Shop.query.get(product.shop_id)
                if shop_obj and shop_obj not in customer_obj.shops:
                    customer_obj.shops.append(shop_obj)

        # 5. Stock Deduction & Pricing
        unit_price = product.selling_price
        unit_type = None
        unit_value = None
        
        if transaction_type == 'SALE':
            if unit_option_id:
                opt = ProductUnitOption.query.get(unit_option_id)
                if opt and opt.product_id == product.id:
                    if opt.stock_quantity < quantity:
                        return jsonify({"message": f"Insufficient stock ({opt.stock_quantity} available)"}), 400
                    opt.stock_quantity -= quantity
                    unit_price = opt.selling_price
                    unit_type = opt.unit_type
                    unit_value = opt.unit_value
                    db.session.flush()
                    product.stock_quantity = sum(o.stock_quantity for o in product.unit_options)
                else:
                    return jsonify({"message": "Invalid variation selected"}), 400
            else:
                if product.stock_quantity < quantity:
                    return jsonify({"message": f"Insufficient stock ({product.stock_quantity} available)"}), 400
                product.stock_quantity -= quantity
        else: # RESTOCK
            product.stock_quantity += quantity
            product.is_archived = False
            ExpiredProduct.query.filter_by(product_id=product.id).delete()

        # 6. Discounts (Birthday / Expiry)
        is_birthday_sale = bool(data.get('is_birthday_sale'))
        birthday_disc_pct = float(data.get('birthday_discount_percent') or 0)
        final_discount = 0.0

        if transaction_type == 'SALE':
            if is_birthday_sale and birthday_disc_pct > 0:
                final_discount = (unit_price * birthday_disc_pct) / 100.0
                unit_price -= final_discount
                offer_code = data.get('birthday_offer_code')
                if offer_code:
                    off = BirthdayOffer.query.filter_by(offer_code=offer_code).first()
                    if off: off.is_used = True
            elif product.expiry_date:
                days = (product.expiry_date - datetime.now().date()).days
                if 0 <= days <= 7:
                    expiry_disc = unit_price * 0.2
                    unit_price -= expiry_disc
                    final_discount = expiry_disc

        # 7. Finalize Transaction
        salesman_obj = Salesman.query.filter_by(salesman_id_code=salesman_id_code).first()
        salesman_db_id = salesman_obj.id if salesman_obj else None
        incentive = 0.0
        if transaction_type == 'SALE' and salesman_obj:
            incentive = ((unit_price * quantity) * salesman_obj.incentive_rate) / 100.0

        new_tx = Transaction(
            shop_id=product.shop_id,
            product_id=product.id,
            transaction_type=transaction_type,
            quantity=quantity,
            unit_price=float(unit_price),
            salesman_id=salesman_db_id,
            customer_id=customer_db_id,
            incentive_amount=float(incentive),
            is_birthday_sale=is_birthday_sale,
            discount_amount=float(final_discount * quantity),
            unit_type=unit_type,
            unit_value=unit_value
        )
        
        if transaction_type == 'SALE' and customer_db_id:
            customer_obj = Customer.query.get(customer_db_id)
            if customer_obj:
                customer_obj.loyalty_points = (customer_obj.loyalty_points or 0) + int((unit_price * quantity) / 100)

        db.session.add(new_tx)
        db.session.commit()
        
        # --- TRIGGER LOW STOCK CHECK AFTER COMMIT ---
        try:
            # Re-fetch product in new session context to be safe
            product = Product.query.get(product.id)
            print(f"DEBUG: Starting Low Stock check for {product.name} (ID: {product.id})")
            
            new_requests_created = []
            
            # 1. Check for individual variation low stock (Primary logic)
            has_variations = len(product.unit_options) > 0
            if has_variations:
                for opt in product.unit_options:
                    # Robust defaults for reorder levels
                    reorder_lvl = opt.reorder_level if opt.reorder_level is not None else 0
                    restock_qty = opt.restock_quantity if opt.restock_quantity is not None else 50
                    
                    print(f"DEBUG: Checking variation {opt.unit_value} {opt.unit_type}: Stock={opt.stock_quantity}, Reorder={reorder_lvl}")
                    
                    if opt.stock_quantity <= reorder_lvl:
                        # Check for existing request for this variation specifically (via notes)
                        active_statuses = ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection', 'Awaiting Payment', 'Paid', 'Shipped']
                        existing_var_req = SupplyRequest.query.filter(
                            SupplyRequest.product_id == product.id,
                            SupplyRequest.status.in_(active_statuses),
                            SupplyRequest.unit_type == opt.unit_type,
                            SupplyRequest.unit_value == opt.unit_value
                        ).first()
                        
                        if not existing_var_req:
                            final_supplier_id = product.supplier_id
                            if not final_supplier_id:
                                shop_obj = Shop.query.get(product.shop_id)
                                if shop_obj and getattr(shop_obj, 'suppliers', None) and len(shop_obj.suppliers) > 0:
                                    final_supplier_id = shop_obj.suppliers[0].id
                            
                            new_var_req = SupplyRequest(
                                shop_id=product.shop_id,
                                product_id=product.id,
                                supplier_id=final_supplier_id,
                                quantity_needed=restock_qty,
                                unit_type=opt.unit_type,
                                unit_value=opt.unit_value,
                                reason='Low Stock (Variation)',
                                notes=f"Auto-restock for {opt.unit_value} {opt.unit_type} pack (Reorder Level: {reorder_lvl}, Current Stock: {opt.stock_quantity})"
                            )
                            db.session.add(new_var_req)
                            new_requests_created.append((new_var_req, restock_qty, opt.unit_type, opt.unit_value))
                            print(f"DEBUG: Queued Supply Request for variation {opt.unit_value} {opt.unit_type} (Qty: {restock_qty})")
            
            # 2. Fallback check for overall product low stock ONLY if no variations exist
            else:
                reorder_lvl = product.reorder_level if product.reorder_level is not None else 20
                restock_quantity = product.restock_quantity if product.restock_quantity is not None else 50
                
                print(f"DEBUG: Checking main stock. Product: {product.name}, Stock: {product.stock_quantity}, Reorder Lvl: {reorder_lvl}")
                
                if product.stock_quantity <= reorder_lvl:
                    # Check for any active request
                    active_statuses = ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection', 'Awaiting Payment', 'Paid', 'Shipped']
                    existing_req = SupplyRequest.query.filter(
                        SupplyRequest.product_id == product.id,
                        SupplyRequest.status.in_(active_statuses)
                    ).first()
                    
                    if not existing_req:
                        final_supplier_id = product.supplier_id
                        if not final_supplier_id:
                            shop_obj = Shop.query.get(product.shop_id)
                            if shop_obj and getattr(shop_obj, 'suppliers', None) and len(shop_obj.suppliers) > 0:
                                final_supplier_id = shop_obj.suppliers[0].id
                        
                        new_req = SupplyRequest(
                            shop_id=product.shop_id,
                            product_id=product.id,
                            supplier_id=final_supplier_id,
                            quantity_needed=restock_quantity,
                            reason='Low Stock'
                        )
                        db.session.add(new_req)
                        new_requests_created.append((new_req, restock_quantity, None, None))
                        print(f"DEBUG: Queued Supply Request ID for {product.name} (Qty: {restock_quantity})")
            
            # Commit all new requests
            if new_requests_created:
                db.session.commit()
                shop_obj = Shop.query.get(product.shop_id)
                for req_obj, qty, u_type, u_val in new_requests_created:
                    notify_suppliers_for_request(shop_obj, product, qty, u_type, u_val)

        except Exception as low_stock_err:
            import traceback
            print(f"ERROR in low stock check: {low_stock_err}")
            traceback.print_exc()

        return jsonify({"message": "Success", "id": new_tx.id}), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        print(traceback.format_exc())
        return jsonify({"message": f"Server Error: {str(e)}"}), 500

def notify_suppliers_for_request(shop_obj, product, qty, unit_type=None, unit_value=None):
    """Helper to notify all relevant suppliers about a new restock request."""
    notified = 0
    shop_name = shop_obj.name if shop_obj else f"Shop #{product.shop_id}"
    p_display = f"{product.name}"
    if unit_type and unit_value:
        p_display += f" ({unit_value} {unit_type})"

    def notify_s(s):
        try:
            if not s.user or not s.user.email: return False
            email_body = f"""
            Dear {s.contact_person or 'Supplier'},
            
            A new restock request has been generated for:
            Shop: {shop_name}
            Product: {p_display} (SKU: {product.sku})
            Quantity Needed: {qty}
            Reason: Low Stock
            
            Please login to the Supplier Portal to submit your quote.
            """
            print(f"DEBUG: Sending restock email to {s.user.email}")
            send_email(s.user.email, "New Restock Request - Action Required", email_body)
            return True
        except Exception as e:
            print(f"Failed to notify supplier {s.id}: {e}")
            return False

    # 1. Notify Linked Suppliers
    if shop_obj and getattr(shop_obj, 'suppliers', None):
        for s in shop_obj.suppliers:
            if notify_s(s): notified += 1
    
    # 2. Fallback: Search all suppliers if none linked or notified
    if notified == 0:
        print("DEBUG: No linked suppliers notified, searching all suppliers with catalog match")
        all_suppliers = Supplier.query.all()
        for s in all_suppliers:
            if find_catalog_match(s.id, product.sku, product.name):
                if notify_s(s): notified += 1
    
    print(f"DEBUG: Total suppliers notified for request: {notified}")

@inventory_bp.route('/', methods=['GET'])
@jwt_required()
def get_products():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    
    if not shop_id:
        return jsonify([]), 200
        
    # Fetch ALL products to check for expired ones
    products = Product.query.filter_by(shop_id=shop_id).all()
    
    result = []
    today = datetime.now().date()
    for p in list(products):
        if p.expiry_date and p.expiry_date <= today:
            # If not already archived, archive it
            if not p.is_archived:
                exists = ExpiredProduct.query.filter_by(product_id=p.id, shop_id=p.shop_id).first()
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
        else:
            # Product is NOT expired.
            # 1. If it was archived, un-archive it
            if p.is_archived:
                p.is_archived = False
                db.session.commit()
                
            # 2. CLEANUP: If there is an entry in ExpiredProduct for this SKU/ID, remove it
            # We check by both product_id and SKU to ensure full cleanup
            ExpiredProduct.query.filter_by(product_id=p.id, shop_id=p.shop_id).delete()
            if p.sku:
                ExpiredProduct.query.filter_by(sku=p.sku, shop_id=p.shop_id).delete()
            db.session.commit()

    # Now re-filter to only show active products on the dashboard
    active_products = [p for p in products if not p.is_archived]
    for p in active_products:
        status = "In Stock"
        discounted_price = None
        
        # Check Expiry
        if p.expiry_date:
            days_to_expiry = (p.expiry_date - datetime.now().date()).days
            if 0 <= days_to_expiry <= 7:
                status = "Expiring Soon"
                discounted_price = p.selling_price * 0.8
            # Fully expired items are auto-archived and removed earlier

        if p.stock_quantity <= p.reorder_level:
            status = "Low Stock"

        result.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "stock": p.stock_quantity,
            "price": p.selling_price,
            "discounted_price": discounted_price,
            "expiry_date": p.expiry_date.strftime('%Y-%m-%d') if p.expiry_date else None,
            "status": status,
            "qr_code": p.qr_code,
            "unit_options": [{
                "id": opt.id,
                "unit_type": opt.unit_type,
                "unit_value": opt.unit_value,
                "selling_price": opt.selling_price,
                "cost_price": opt.cost_price,
                "stock_quantity": opt.stock_quantity,
                "reorder_level": opt.reorder_level,
                "restock_quantity": opt.restock_quantity
            } for opt in p.unit_options]
        })
    return jsonify(result), 200

@inventory_bp.route('/history', methods=['GET'])
@jwt_required()
def get_sales_history():
    try:
        from sqlalchemy import text
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        role = current_user.get('role')
        shop_id = get_shop_id_for_user(current_user)
        
        print(f"DEBUG: Sales History API - UserID: {user_id}, Role: {role}, ShopID: {shop_id}")
        
        if not shop_id:
            return jsonify([]), 200
            
        # Build raw SQL query for maximum reliability
        sql = "SELECT t.*, p.name as product_name, s.name as salesman_name, c.name as customer_name " \
              "FROM transactions t " \
              "LEFT JOIN products p ON t.product_id = p.id " \
              "LEFT JOIN salesmen s ON t.salesman_id = s.id " \
              "LEFT JOIN customers c ON t.customer_id = c.id " \
              "WHERE t.shop_id = :shop_id AND t.transaction_type = 'SALE' "
        
        params = {"shop_id": int(shop_id)}
        
        if role == 'salesman':
            # Need to find the salesman.id for this user.id
            salesman = Salesman.query.filter_by(user_id=user_id).first()
            if salesman:
                sql += "AND t.salesman_id = :salesman_id "
                params["salesman_id"] = salesman.id
            else:
                return jsonify([]), 200
                
        sql += "ORDER BY t.date DESC"
        
        # Get total sales for each product in this shop to determine badges
        summary_sql = "SELECT product_id, SUM(quantity) as total_qty " \
                      "FROM transactions " \
                      "WHERE shop_id = :shop_id AND transaction_type = 'SALE' " \
                      "GROUP BY product_id"
        summary_result = db.session.execute(text(summary_sql), {"shop_id": int(shop_id)})
        product_totals = {row._mapping['product_id']: row._mapping['total_qty'] for row in summary_result}
        
        # Heuristic for badges based on historical totals
        max_sold = max(product_totals.values()) if product_totals else 0
        
        def get_historical_badge(pid):
            qty = product_totals.get(pid, 0)
            if max_sold == 0: return "Less Sold"
            ratio = qty / max_sold
            if ratio >= 0.7: return "Most Sold"
            if ratio >= 0.3: return "Moderately Sold"
            return "Less Sold"

        result = db.session.execute(text(sql), params)
        history = []
        
        for row in result:
            # SQLAlchemy row is a mapping in recent versions or a tuple
            # Let's handle it carefully
            r = dict(row._mapping)
            
            # Robust date formatting
            date_val = r.get('date')
            date_str = "N/A"
            if date_val:
                if isinstance(date_val, datetime):
                    date_str = date_val.strftime('%Y-%m-%d %H:%M:%S')
                elif isinstance(date_val, str):
                    date_str = date_val.split('.')[0] # Remove fractional seconds if string
                else:
                    date_str = str(date_val)

            pid = r.get('product_id')
            history.append({
                "id": r.get('id'),
                "product_id": pid,
                "product_name": r.get('product_name') or f"Product #{pid}",
                "date": date_str,
                "quantity": r.get('quantity'),
                "total_price": float((r.get('quantity') or 0) * (r.get('unit_price') or 0)),
                "salesman": r.get('salesman_name') or "System",
                "customer_name": r.get('customer_name') or "-",
                "is_birthday_sale": bool(r.get('is_birthday_sale')),
                "historical_badge": get_historical_badge(pid),
                "discount_amount": r.get('discount_amount') or 0,
                "unit_type": r.get('unit_type'),
                "unit_value": r.get('unit_value')
            })
            
        print(f"DEBUG: Returning {len(history)} records from raw SQL")
        return jsonify(history), 200
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"message": f"Server Error: {str(e)}"}), 500

@inventory_bp.route('/analytics/sales', methods=['GET'])
@jwt_required()
def get_sales_analytics():
    try:
        from sqlalchemy import text
        current_user = get_jwt_identity()
        shop_id = get_shop_id_for_user(current_user)
        if not shop_id: return jsonify([]), 200
        
        # Use raw SQL for analytics as well to ensure consistency
        sql = "SELECT t.date, t.quantity, t.unit_price, p.cost_price, p.selling_price " \
              "FROM transactions t " \
              "JOIN products p ON t.product_id = p.id " \
              "WHERE t.shop_id = :shop_id AND t.transaction_type = 'SALE' " \
              "ORDER BY t.date ASC"
        
        result = db.session.execute(text(sql), {"shop_id": int(shop_id)})
        sales_map = {}
        
        for row in result:
            r = dict(row._mapping)
            date_val = r.get('date')
            
            if not date_val: continue
            
            if isinstance(date_val, datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                date_str = str(date_val).split(' ')[0]
                
            sold_price = r.get('unit_price') or r.get('selling_price') or 0
            cost_price = r.get('cost_price') or 0
            quantity = r.get('quantity') or 0
            
            revenue = quantity * sold_price
            profit = quantity * (sold_price - cost_price)
            
            if date_str not in sales_map:
                sales_map[date_str] = {'revenue': 0, 'profit': 0}
                
            sales_map[date_str]['revenue'] += revenue
            sales_map[date_str]['profit'] += profit
            
        final_result = []
        for date, data in sales_map.items():
            final_result.append({
                "date": date,
                "revenue": data['revenue'],
                "profit": data['profit']
            })
            
        return jsonify(final_result), 200
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"message": f"Analytics Error: {str(e)}"}), 500

@inventory_bp.route('/', methods=['POST'])
@jwt_required()
def add_product():
    current_user = get_jwt_identity()
    if current_user['role'] != 'shop_owner':
        return jsonify({"message": "Unauthorized"}), 403
        
    data = request.get_json() or {}
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    # Safe parsing helpers
    def safe_float(v, default=0.0):
        try: return float(v) if v not in [None, ''] else default
        except: return default
    
    def safe_int(v, default=0):
        try: return int(v) if v not in [None, ''] else default
        except: return default

    try:
        shelf_life = None
        if data.get('shelf_life_days') not in [None, '']:
            shelf_life = int(data.get('shelf_life_days'))
            
        # AUTO-GENERATE UNIQUE QR CODE (OQ CODE)
        import uuid
        qr_code = f"QR-{uuid.uuid4().hex[:8].upper()}"
        while Product.query.filter_by(qr_code=qr_code).first():
            qr_code = f"QR-{uuid.uuid4().hex[:8].upper()}"

        # Get first variation prices as default for Product table compatibility
        unit_options = data.get('unit_options', [])
        default_cost = 0.0
        default_selling = 0.0
        total_stock = 0
        min_reorder = 20
        max_restock = 50

        if unit_options:
            try:
                default_cost = safe_float(unit_options[0].get('cost_price'))
                default_selling = safe_float(unit_options[0].get('selling_price'))
                
                # Calculate aggregates for the Product table
                total_stock = sum(safe_int(opt.get('stock_quantity')) for opt in unit_options)
                
                # For reorder level, take the minimum across variations (alert if ANY is low)
                reorder_levels = [safe_int(opt.get('reorder_level'), 20) for opt in unit_options]
                if reorder_levels: min_reorder = min(reorder_levels)
                
                # For restock quantity, take the maximum (general request size)
                restock_quantities = [safe_int(opt.get('restock_quantity'), 50) for opt in unit_options]
                if restock_quantities: max_restock = max(restock_quantities)
                
                print(f"DEBUG: Adding Product - Name: {data.get('name')}, Total Stock: {total_stock}, Variations: {len(unit_options)}")
            except Exception as e:
                print(f"DEBUG: Error aggregating variation data: {e}")
                pass

        p = Product(
            sku=data.get('sku'),
            name=data.get('name'),
            category=data.get('category') or 'General',
            cost_price=default_cost,
            selling_price=default_selling,
            stock_quantity=total_stock,
            min_level=safe_int(data.get('min_level'), 10),
            reorder_level=min_reorder,
            restock_quantity=max_restock,
            shelf_life_days=shelf_life,
            shop_id=shop.id,
            qr_code=qr_code,
            expiry_date=datetime.strptime(data['expiry_date'], '%Y-%m-%d').date() if data.get('expiry_date') else None
        )
        db.session.add(p)
        db.session.flush() # Get product ID

        # Handle Unit Options
        added_options = []
        for opt in unit_options:
            try:
                new_opt = ProductUnitOption(
                    product_id=p.id,
                    unit_type=opt.get('unit_type') or 'units',
                    unit_value=safe_float(opt.get('unit_value')),
                    cost_price=safe_float(opt.get('cost_price')),
                    selling_price=safe_float(opt.get('selling_price')),
                    stock_quantity=safe_int(opt.get('stock_quantity')),
                    reorder_level=safe_int(opt.get('reorder_level'), 10),
                    restock_quantity=safe_int(opt.get('restock_quantity'), 50)
                )
                db.session.add(new_opt)
                added_options.append(new_opt)
            except Exception as ve:
                print(f"DEBUG: Skipping invalid unit option: {ve}")
                continue

        db.session.commit()
        
        # RE-FETCH product to ensure all relationships (unit_options) are loaded in a fresh state
        db.session.refresh(p)
        
        # Immediate check for Low Stock after adding
        # 1. Check variations (Primary logic)
        if p.unit_options:
            # Determine a default supplier_id for these requests
            default_supplier_id = p.supplier_id
            if not default_supplier_id:
                shop_obj = Shop.query.get(p.shop_id)
                if shop_obj and getattr(shop_obj, 'suppliers', None) and len(shop_obj.suppliers) > 0:
                    default_supplier_id = shop_obj.suppliers[0].id

            for opt in p.unit_options:
                print(f"DEBUG: Checking initial stock for variation {opt.unit_value} {opt.unit_type}: Stock={opt.stock_quantity}, Reorder={opt.reorder_level}")
                if opt.stock_quantity <= opt.reorder_level:
                    # Check if request already exists to avoid duplicates
                    active_statuses = ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection', 'Awaiting Payment', 'Paid', 'Shipped']
                    existing = SupplyRequest.query.filter(
                        SupplyRequest.product_id == p.id,
                        SupplyRequest.status.in_(active_statuses),
                        SupplyRequest.unit_type == opt.unit_type,
                        SupplyRequest.unit_value == opt.unit_value
                    ).first()
                    
                    if not existing:
                        new_var_req = SupplyRequest(
                            shop_id=p.shop_id,
                            product_id=p.id,
                            supplier_id=default_supplier_id,
                            quantity_needed=opt.restock_quantity or 50,
                            unit_type=opt.unit_type,
                            unit_value=opt.unit_value,
                            reason='Low Stock Initial (Variation)',
                            notes=f"Initial restock for {opt.unit_value} {opt.unit_type} pack (Reorder Level: {opt.reorder_level}, Current Stock: {opt.stock_quantity})"
                        )
                        db.session.add(new_var_req)
                        print(f"DEBUG: Created initial restock request for variation {opt.unit_value} {opt.unit_type}")
        
        # 2. Fallback check for overall product stock ONLY if no variations exist
        elif p.stock_quantity <= p.reorder_level:
            restock_qty = p.restock_quantity if p.restock_quantity else (p.max_level - p.stock_quantity)
            if restock_qty <= 0: restock_qty = 50
            
            # Determine a default supplier_id
            default_supplier_id = p.supplier_id
            if not default_supplier_id:
                shop_obj = Shop.query.get(p.shop_id)
                if shop_obj and getattr(shop_obj, 'suppliers', None) and len(shop_obj.suppliers) > 0:
                    default_supplier_id = shop_obj.suppliers[0].id

            new_req = SupplyRequest(
                shop_id=p.shop_id,
                product_id=p.id,
                supplier_id=default_supplier_id,
                quantity_needed=restock_qty,
                reason='Low Stock Initial'
            )
            db.session.add(new_req)
        
        db.session.commit()
        print("DEBUG: Final commit for initial restock requests completed.")

        if p.expiry_date and p.expiry_date <= datetime.now().date():
            exists = ExpiredProduct.query.filter_by(product_id=p.id, shop_id=p.shop_id).first()
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
            return jsonify({"message": "Product added as expired and archived", "archived": True}), 201
        return jsonify({"message": "Product added", "id": p.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Invalid data: {str(e)}"}), 400

@inventory_bp.route('/expired', methods=['GET'])
@jwt_required()
def get_expired_products():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id:
        return jsonify([]), 200
        
    # --- RIGOROUS SYNC & CLEANUP ---
    today = datetime.now().date()
    
    # Get all entries currently in the expired table for this shop
    all_expired_entries = ExpiredProduct.query.filter_by(shop_id=shop_id).all()
    
    for entry in all_expired_entries:
        # Check if there's any ACTIVE (not archived) product with this SKU or Name in the main table
        # that is NOT expired.
        active_restocked = Product.query.filter(
            Product.shop_id == shop_id,
            Product.is_archived == False,
            (Product.sku == entry.sku) | (Product.name == entry.name),
            Product.expiry_date > today
        ).first()
        
        if active_restocked:
            # If an active, non-expired version exists, this entry is stale and MUST be deleted
            print(f"STRICT CLEANUP: Removing stale expired entry for {entry.name} (SKU: {entry.sku})")
            db.session.delete(entry)
            db.session.commit()
            continue

        # Also check the specific product_id if the above SKU/Name check missed it
        p_by_id = Product.query.get(entry.product_id)
        if p_by_id and not p_by_id.is_archived and p_by_id.expiry_date and p_by_id.expiry_date > today:
            print(f"STRICT CLEANUP: Removing stale expired entry for {entry.name} (ID: {entry.product_id})")
            db.session.delete(entry)
            db.session.commit()

    # Final fetch of the cleaned list
    archived = ExpiredProduct.query.filter_by(shop_id=shop_id).order_by(ExpiredProduct.archived_at.desc()).all()
    
    result = []
    for p in archived:
        sales = Transaction.query.filter_by(product_id=p.product_id, shop_id=shop_id, transaction_type='SALE').all()
        qty = sum(s.quantity for s in sales)
        last_sale = max((s.date for s in sales), default=None)
        result.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "stock": p.stock_at_expiry,
            "expiry_date": p.expiry_date.strftime('%Y-%m-%d') if p.expiry_date else None,
            "shelf_life_days": p.shelf_life_days,
            "total_sold": qty,
            "last_sale": last_sale.strftime('%Y-%m-%d %H:%M:%S') if last_sale else None
        })
    return jsonify(result), 200

@inventory_bp.route('/expired/<int:expired_id>/restock-email', methods=['POST'])
@jwt_required()
def email_restock_for_expired(expired_id):
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
    body = request.get_json() or {}
    qty = int(body.get('quantity', 0))
    if qty <= 0:
        return jsonify({"message": "Quantity must be positive"}), 400
    archived = ExpiredProduct.query.filter_by(id=expired_id, shop_id=shop.id).first()
    if not archived:
        return jsonify({"message": "Expired item not found"}), 404

    # Check for any active request for this product
    active_statuses = ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection', 'Awaiting Payment', 'Paid', 'Shipped']
    existing_req = SupplyRequest.query.filter(
        SupplyRequest.product_id == archived.product_id,
        SupplyRequest.status.in_(active_statuses)
    ).first()

    if existing_req:
        return jsonify({"message": "An active restock request already exists for this product"}), 400

    # Create a SupplyRequest for the archived product's ID (which corresponds to its original Product ID)
    new_req = SupplyRequest(
        shop_id=shop.id,
        product_id=archived.product_id,
        quantity_needed=qty,
        reason=f"Expired Product (archived on {archived.archived_at.strftime('%Y-%m-%d')})"
    )
    db.session.add(new_req)
    db.session.commit()

    # Notify all linked suppliers who have this product SKU in their catalog
    notified = 0
    if getattr(shop, 'suppliers', None):
        for s in shop.suppliers:
            # Check if supplier has this product in catalog using flexible matching
            in_catalog = find_catalog_match(s.id, archived.sku, archived.name)
            if in_catalog and s.user and s.user.email:
                try:
                    content = f"""
                    Dear {s.contact_person or 'Supplier'},
                    
                    A restock request has been generated for an expired item:
                    Shop: {shop.name}
                    Product: {archived.name} (SKU: {archived.sku})
                    Quantity Needed: {qty}
                    
                    Please login to the Supplier Portal to submit your quote.
                    """
                    send_email(s.user.email, "Restock Request - Expired Item", content)
                    notified += 1
                except Exception:
                    pass

    if notified == 0:
        # Fallback: check ALL suppliers who have this in their catalog
        all_suppliers = Supplier.query.all()
        for s in all_suppliers:
            in_catalog = find_catalog_match(s.id, archived.sku, archived.name)
            if in_catalog and s.user and s.user.email:
                try:
                    content = f"""
                    Dear {s.contact_person or 'Supplier'},
                    
                    A restock request has been generated for an expired item:
                    Shop: {shop.name}
                    Product: {archived.name} (SKU: {archived.sku})
                    Quantity Needed: {qty}
                    
                    Please login to the Supplier Portal to submit your quote.
                    """
                    send_email(s.user.email, "Restock Request - Expired Item", content)
                    notified += 1
                except Exception:
                    pass

    return jsonify({"message": "Restock request created and relevant suppliers notified"}), 200
@inventory_bp.route('/expired/<int:expired_id>/sales', methods=['GET'])
@jwt_required()
def sales_for_expired(expired_id):
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop: 
        return jsonify([]), 200
    archived = ExpiredProduct.query.filter_by(id=expired_id, shop_id=shop.id).first()
    if not archived:
        return jsonify([]), 200
    tx = Transaction.query.filter(Transaction.shop_id==shop.id, Transaction.transaction_type=='SALE', Transaction.product_id==archived.product_id).all()
    from datetime import timedelta
    day_map = {}
    for t in tx:
        d = t.date.strftime('%Y-%m-%d')
        day_map[d] = day_map.get(d, 0) + t.quantity
    total_qty = sum(day_map.values())
    series = [{"date": k, "quantity": v} for k, v in sorted(day_map.items())]
    return jsonify({"product_id": archived.product_id, "name": archived.name, "sku": archived.sku, "total_sold": total_qty, "daily": series}), 200
@inventory_bp.route('/sales/summary', methods=['GET'])
@jwt_required()
def sales_summary_by_product():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id: return jsonify([]), 200
    
    # Current month totals per product (Using UTC date for consistency)
    from datetime import datetime
    today_utc = datetime.utcnow().date()
    start_month = today_utc.replace(day=1)
    tx = Transaction.query.filter(Transaction.shop_id==shop_id, Transaction.transaction_type=='SALE', Transaction.date>=start_month).all()
    totals = {}
    for t in tx:
        totals[t.product_id] = totals.get(t.product_id, 0) + t.quantity
    if not totals:
        return jsonify([]), 200
    most_id = max(totals, key=totals.get)
    least_id = min(totals, key=totals.get)
    result = []
    for pid, qty in totals.items():
        prod = Product.query.get(pid)
        name = prod.name if prod else f"Product {pid}"
        badge = 'normal'
        if pid == most_id: badge = 'most'
        if pid == least_id: badge = 'least'
        result.append({"product_id": pid, "name": name, "month_qty": qty, "badge": badge})
    return jsonify(result), 200

@inventory_bp.route('/sales/daily', methods=['GET'])
@jwt_required()
def sales_daily_by_product():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id: return jsonify([]), 200
    product_id = request.args.get('product_id', type=int)
    if not product_id: return jsonify([]), 200
    from datetime import timedelta
    start = datetime.now() - timedelta(days=30)
    tx = Transaction.query.filter(Transaction.shop_id==shop_id, Transaction.transaction_type=='SALE', Transaction.product_id==product_id, Transaction.date>=start).all()
    day_map = {}
    for t in tx:
        d = t.date.strftime('%Y-%m-%d')
        day_map[d] = day_map.get(d, 0) + t.quantity
    series = [{"date": k, "quantity": v} for k, v in sorted(day_map.items())]
    return jsonify(series), 200

@inventory_bp.route('/requests', methods=['GET'])
@jwt_required()
def list_shop_requests():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id:
        return jsonify([]), 200
    reqs = SupplyRequest.query.filter_by(shop_id=shop_id).order_by(SupplyRequest.request_date.desc()).all()
    result = []
    for r in reqs:
        prod = Product.query.get(r.product_id)
        quotes = SupplierQuote.query.filter_by(supply_request_id=r.id).all()
        q_list = []
        for q in quotes:
            supplier = Supplier.query.get(q.supplier_id)
            q_list.append({
                "id": q.id,
                "supplier": supplier.company_name if supplier else None,
                "unit_price": q.unit_price,
                "discount_percent": q.discount_percent,
                "total": q.total,
                "status": q.status,
                "is_provisional": q.status == 'Provisional',
                "created_at": q.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        result.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_name": prod.name if prod else None,
            "quantity": r.quantity_needed,
            "unit_type": r.unit_type,
            "unit_value": r.unit_value,
            "status": r.status,
            "reason": r.reason,
            "request_date": r.request_date.strftime('%Y-%m-%d'),
            "quotes": q_list
        })
    return jsonify(result), 200

@inventory_bp.route('/requests/<int:req_id>/quotes', methods=['GET'])
@jwt_required()
def get_quotes_for_request(req_id):
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify([]), 200
    req = SupplyRequest.query.get(req_id)
    if not req or req.shop_id != shop.id:
        return jsonify([]), 200
    quotes = SupplierQuote.query.filter_by(supply_request_id=req.id).all()
    res = []
    for q in quotes:
        supplier = Supplier.query.get(q.supplier_id)
        res.append({
            "id": q.id,
            "supplier": supplier.company_name if supplier else None,
            "unit_price": q.unit_price,
            "discount_percent": q.discount_percent,
            "total": q.total,
            "gst_amount": q.gst_amount,
            "grand_total": q.grand_total,
            "status": q.status
        })
    return jsonify(res), 200

@inventory_bp.route('/diagnostic/db-sync', methods=['POST'])
@jwt_required()
def force_db_sync():
    """Manual trigger to create tables if they are missing."""
    try:
        current_user = get_jwt_identity()
        if current_user.get('role') != 'admin' and current_user.get('role') != 'shop_owner':
            return jsonify({"message": "Unauthorized"}), 403
            
        from models import db
        db.create_all()
        return jsonify({"message": "Database tables creation triggered successfully"}), 200
    except Exception as e:
        return jsonify({"message": f"Sync Error: {str(e)}"}), 500

@inventory_bp.route('/quotes/<int:quote_id>/accept', methods=['POST'])
@jwt_required()
def accept_quote(quote_id):
    try:
        current_user = get_jwt_identity()
        print(f"DEBUG: accept_quote called by user {current_user['id']} for quote {quote_id}")
        
        shop_id = get_shop_id_for_user(current_user)
        if not shop_id:
            return jsonify({"message": "Shop not found for this user. Please ensure you have registered a shop profile."}), 404
            
        shop = Shop.query.get(shop_id)
        if not shop:
            return jsonify({"message": f"Shop ID {shop_id} not found in database"}), 404
            
        q = SupplierQuote.query.get(quote_id)
        if not q:
            return jsonify({"message": f"Quote #{quote_id} not found"}), 404
            
        if q.shop_id != shop.id:
            return jsonify({"message": "Unauthorized: This quote belongs to another shop"}), 403
            
        req = SupplyRequest.query.get(q.supply_request_id)
        if not req:
            return jsonify({"message": "Original restock request not found"}), 404
            
        if req.shop_id != shop.id:
            return jsonify({"message": "Unauthorized: This request belongs to another shop"}), 403
        
        # 1. Mark other quotes for this request as Rejected
        try:
            other_quotes = SupplierQuote.query.filter(
                SupplierQuote.supply_request_id == req.id,
                SupplierQuote.id != q.id
            ).all()
            for oq in other_quotes:
                oq.status = 'Rejected'
        except Exception as e:
            print(f"DEBUG: Error rejecting other quotes: {e}")

        # 2. Accept this quote
        q.status = 'Accepted'
        req.supplier_id = q.supplier_id
        req.status = 'Awaiting Payment'
        
        # 3. Create bill
        bill = SupplierBill(
            shop_id=shop.id,
            supplier_id=q.supplier_id,
            product_id=q.product_id,
            supply_request_id=q.supply_request_id,
            quantity=req.quantity_needed,
            unit_type=req.unit_type,
            unit_value=req.unit_value,
            unit_price=q.unit_price,
            discount_percent=q.discount_percent,
            total=q.total,
            gst_amount=q.gst_amount,
            grand_total=q.grand_total,
            status='Awaiting Payment'
        )
        db.session.add(bill)
        
        # 4. Notifications
        owner = User.query.get(shop.owner_id)
        supplier_obj = Supplier.query.get(q.supplier_id)
        supplier_name = supplier_obj.company_name if supplier_obj else "Supplier"
        
        if owner and owner.email:
            try:
                subject = f"Restock Quote Accepted - Payment Required for {req.product.name}"
                content = f"You have accepted a quote from {supplier_name}.\n\n" \
                          f"Order Details:\n" \
                          f"Product: {req.product.name}\n" \
                          f"Quantity: {req.quantity_needed}\n" \
                          f"Total (Excl. GST): ₹{q.total:.2f}\n" \
                          f"GST (18%): ₹{q.gst_amount:.2f}\n" \
                          f"Grand Total: ₹{q.grand_total:.2f}\n\n" \
                          f"Please login and complete the payment to proceed with the restock."
                send_email(owner.email, subject, content)
            except Exception as e:
                print(f"DEBUG: Failed to send owner email: {e}")

        if supplier_obj and supplier_obj.user and supplier_obj.user.email:
            try:
                subject = f"Your Quote for {req.product.name} was Accepted!"
                content = f"Congratulations! Your quote for {req.product.name} has been accepted by {shop.name}.\n\n" \
                           f"Order Details:\n" \
                           f"Shop: {shop.name}\n" \
                           f"Product: {req.product.name}\n" \
                           f"Quantity: {req.quantity_needed}\n" \
                           f"Total (Excl. GST): ₹{q.total:.2f}\n" \
                           f"GST (18%): ₹{q.gst_amount:.2f}\n" \
                           f"Grand Total: ₹{q.grand_total:.2f}\n\n" \
                           f"You will be notified once the payment is completed so you can ship the order."
                send_email(supplier_obj.user.email, subject, content)
            except Exception as e:
                print(f"DEBUG: Failed to send supplier email: {e}")

        db.session.commit()
        print(f"DEBUG: Quote {q.id} accepted. Bill {bill.id} generated.")
        return jsonify({"message": "Quote accepted and bill generated", "bill_id": bill.id}), 200
        
    except Exception as e:
        db.session.rollback()
        import traceback
        error_msg = str(e)
        # Check for specific DB errors to provide better messages
        if "relation" in error_msg and "does not exist" in error_msg:
            error_msg = "Database schema issue: Some tables are missing. Please contact support or try again later."
            
        print(f"CRITICAL ERROR in accept_quote: {str(e)}")
        traceback.print_exc()
        return jsonify({"message": f"Server Error: {error_msg}"}), 500

@inventory_bp.route('/bills/<int:bill_id>/retry-restock', methods=['POST'])
@jwt_required()
def retry_restock(bill_id):
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    bill = SupplierBill.query.get_or_404(bill_id)
    if bill.shop_id != shop.id:
        return jsonify({"message": "Unauthorized"}), 403
        
    if bill.status != 'Failed':
        return jsonify({"message": "Only failed deliveries can be retried."}), 400
        
    # Generate new restock request manually
    new_req = SupplyRequest(
        shop_id=shop.id,
        product_id=bill.product_id,
        quantity_needed=bill.quantity,
        reason=f"Restock retry: Previous delivery failed (Unpaid Bill #{bill.id})"
    )
    db.session.add(new_req)
    
    # Update bill status to 'Retried' to hide it from retry list
    bill.status = 'Retried'
    db.session.commit()
    
    return jsonify({"message": "New restock request generated successfully", "request_id": new_req.id}), 200

@inventory_bp.route('/<int:product_id>/delete', methods=['POST'])
@inventory_bp.route('/<int:product_id>/delete/', methods=['POST'])
@jwt_required()
def delete_product_post(product_id):
    current_user = get_jwt_identity()
    if current_user['role'] != 'shop_owner':
        return jsonify({"message": "Unauthorized"}), 403
        
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"message": "Product not found"}), 404
        
    if product.shop_id != shop.id:
        return jsonify({"message": "Unauthorized to delete this product"}), 403
        
    db.session.delete(product)
    db.session.commit()
    
    return jsonify({"message": "Product deleted successfully"}), 200

@inventory_bp.route('/<int:product_id>', methods=['DELETE', 'OPTIONS'])
@jwt_required()
def delete_product(product_id):
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200

    current_user = get_jwt_identity()
    if current_user['role'] != 'shop_owner':
        return jsonify({"message": "Unauthorized"}), 403
        
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"message": "Product not found"}), 404
        
    if product.shop_id != shop.id:
        return jsonify({"message": "Unauthorized to delete this product"}), 403
        
    db.session.delete(product)
    db.session.commit()
    
    return jsonify({"message": "Product deleted successfully"}), 200
