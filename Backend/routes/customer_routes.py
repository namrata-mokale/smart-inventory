from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Customer, Shop, Product, Sale, Salesman, MonthlyRation, MonthlyRationItem, MonthlyRationOrder, MonthlyRationOrderItem
from services.notification_service import send_email

customer_bp = Blueprint('customer', __name__)

def get_shop_id_for_user(current_user):
    user_id = current_user['id']
    role = current_user['role']
    if role == 'shop_owner':
        shop = Shop.query.filter_by(owner_id=user_id).first()
        return shop.id if shop else None
    elif role == 'salesman':
        salesman = Salesman.query.filter_by(user_id=user_id).first()
        if salesman: return salesman.shop_id
        return current_user.get('shop_id')
    return None

@customer_bp.route('/', methods=['GET'])
@jwt_required()
def get_customers():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id:
        return jsonify({"message": "Shop not found"}), 404
        
    shop = Shop.query.get(shop_id)
    customers = shop.customers_linked
    return jsonify([{
        "id": c.id,
        "customer_id_code": c.customer_id_code,
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "address": c.address,
        "dob": c.dob,
        "joined": c.created_at.strftime('%Y-%m-%d')
    } for c in customers]), 200

@customer_bp.route('/', methods=['POST'])
@jwt_required()
def add_customer():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id:
        return jsonify({"message": "Shop not found"}), 404
        
    data = request.get_json()
    
    # Required fields validation
    if not data.get('name') or not data.get('email') or not data.get('phone'):
        return jsonify({"message": "Name, Email, and Phone are required"}), 400
        
    import random
    import string
    unique_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    new_customer = Customer(
        customer_id_code=unique_id,
        name=data['name'],
        email=data['email'],
        phone=data['phone'],
        address=data.get('address', ''),
        dob=data.get('dob')
    )
    
    # Link to the shop
    shop = Shop.query.get(shop_id)
    if shop:
        new_customer.shops.append(shop)
        
    db.session.add(new_customer)
    db.session.commit()
    
    # Send birthday wish if birthday is today
    try:
        from services.notification_service import send_birthday_wish
        send_birthday_wish(new_customer)
    except Exception as e:
        print(f"DEBUG: Error sending birthday wish on add_customer: {e}")
    
    return jsonify({"message": "Customer added successfully", "id": new_customer.id, "customer_id_code": unique_id}), 201

@customer_bp.route('/me', methods=['GET'])
@jwt_required()
def get_customer_profile():
    current_user = get_jwt_identity()
    user_id = current_user['id']
    customer = Customer.query.filter_by(user_id=user_id).first()
    
    # Auto-create profile if missing for customer role
    if not customer:
        from models import User
        user = User.query.get(user_id)
        if user and user.role == 'customer':
            import random
            import string
            unique_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            customer = Customer(
                customer_id_code=unique_id,
                name=user.name,
                email=user.email,
                phone=user.phone,
                address=user.address or 'Not provided',
                user_id=user.id
            )
            db.session.add(customer)
            db.session.commit()
        else:
            return jsonify({"message": "Customer profile not found"}), 404
        
    return jsonify({
        "id": customer.id,
        "customer_id_code": customer.customer_id_code,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "dob": customer.dob,
        "loyalty_points": customer.loyalty_points,
        "linked_shops": [{"id": s.id, "name": s.name, "location": s.location} for s in customer.shops]
    }), 200

@customer_bp.route('/link-shop', methods=['POST'])
@jwt_required()
def link_to_shop():
    print("DEBUG: /link-shop endpoint HIT")
    current_user = get_jwt_identity()
    user_id = current_user['id']
    customer = Customer.query.filter_by(user_id=user_id).first()
    
    # Auto-create profile if missing for customer role
    if not customer:
        from models import User
        user = User.query.get(user_id)
        if user and user.role == 'customer':
            import random
            import string
            unique_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            customer = Customer(
                customer_id_code=unique_id,
                name=user.name,
                email=user.email,
                phone=user.phone,
                address=user.address or 'Not provided',
                user_id=user.id
            )
            db.session.add(customer)
            db.session.commit()
            print(f"DEBUG: Auto-created customer profile for user {user_id}")
        else:
            return jsonify({"message": "Customer profile not found"}), 404
        
    data = request.get_json()
    shop_id = data.get('shop_id')
    print(f"DEBUG: Linking customer {customer.id} to shop {shop_id}")
    
    shop = Shop.query.get(shop_id)
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    if shop not in customer.shops:
        customer.shops.append(shop)
        db.session.commit()
        print(f"DEBUG: Successfully linked to {shop.name}")
    else:
        print(f"DEBUG: Customer already linked to {shop.name}")
    
    return jsonify({"message": f"Successfully linked to {shop.name}"}), 200

@customer_bp.route('/all-shops', methods=['GET'])
@jwt_required()
def get_all_shops():
    shops = Shop.query.all()
    return jsonify([{"id": s.id, "name": s.name, "location": s.location} for s in shops]), 200

@customer_bp.route('/birthday-offers', methods=['GET'])
@jwt_required()
def get_birthday_offers():
    from datetime import date, timedelta
    import random
    import string
    from models import BirthdayOffer, Shop
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify([])
        
    today = date.today()
    
    # Check if today is birthday and reward not used this year
    is_birthday = False
    if customer.dob:
        try:
            # Handle different DOB formats
            dob_str = customer.dob
            if '-' in dob_str:
                dob_parts = dob_str.split('-')
                if len(dob_parts) == 3: # YYYY-MM-DD or DD-MM-YYYY
                    if len(dob_parts[0]) == 4: # YYYY-MM-DD
                        dob_month_day = f"{dob_parts[1]}-{dob_parts[2]}"
                    else: # DD-MM-YYYY
                        dob_month_day = f"{dob_parts[1]}-{dob_parts[0]}"
                elif len(dob_parts) == 2: # MM-DD
                    dob_month_day = dob_str
            
            if dob_month_day == today.strftime('%m-%d'):
                is_birthday = True
        except:
            pass

    # If it's birthday, ensure offers exist for EACH linked shop
    if is_birthday:
        for shop in customer.shops:
            # Check if an unused valid offer exists for THIS shop
            existing_offer = BirthdayOffer.query.filter_by(
                customer_id=customer.id, 
                shop_id=shop.id,
                is_used=False
            ).filter(BirthdayOffer.valid_until >= today).first()
            
            if not existing_offer:
                # Random discount between 10% and 25%
                discount = random.choice([10, 15, 20, 25])
                offer_code = 'BDAY-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                
                new_offer = BirthdayOffer(
                    customer_id=customer.id,
                    shop_id=shop.id,
                    discount_percent=discount,
                    offer_code=offer_code,
                    offer_text=f"Special {discount}% Birthday Discount for you at {shop.name}!",
                    valid_until=today + timedelta(days=5) # Valid for 5 days as requested
                )
                db.session.add(new_offer)
        db.session.commit()
            
    offers = BirthdayOffer.query.filter_by(
        customer_id=customer.id, 
        is_used=False
    ).filter(BirthdayOffer.valid_until >= today).all()
    
    return jsonify([{
        "id": o.id,
        "shop_id": o.shop_id,
        "shop_name": o.shop.name,
        "discount_percent": o.discount_percent,
        "offer_code": o.offer_code,
        "offer_text": o.offer_text,
        "valid_until": o.valid_until.strftime('%Y-%m-%d')
    } for o in offers]), 200

@customer_bp.route('/search', methods=['GET'])
@jwt_required()
def search_customer_by_phone():
    phone = request.args.get('phone')
    if not phone:
        return jsonify({"message": "Phone number required"}), 400
        
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    
    customer = Customer.query.filter_by(phone=phone).first()
    if not customer:
        return jsonify({"message": "Customer not found"}), 404
        
    # Check for birthday discount for current shop
    from datetime import date
    from models import BirthdayOffer
    today = date.today()
    
    # Check if today is birthday
    is_birthday = False
    if customer.dob and customer.dob[5:10] == today.strftime('%m-%d'):
        is_birthday = True
        
    birthday_discount = 0
    offer_code = None
    is_birthday_offer_active = False # New flag to return
    if shop_id:
        # Find active unused offer for this shop (valid within 5 days of birthday)
        offer = BirthdayOffer.query.filter_by(
            customer_id=customer.id, 
            shop_id=shop_id,
            is_used=False
        ).filter(BirthdayOffer.valid_until >= today).first()
        
        if offer:
            # We only show the discount if the offer is active and unused
            birthday_discount = offer.discount_percent
            offer_code = offer.offer_code
            is_birthday_offer_active = True
            
    return jsonify({
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "dob": customer.dob,
        "is_birthday": is_birthday_offer_active, # Only return true if offer is active and UNUSED
        "birthday_discount": birthday_discount,
        "offer_code": offer_code
    }), 200

@customer_bp.route('/history', methods=['GET'])
@jwt_required()
def get_purchase_history():
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify({"message": "Customer profile not found"}), 404
        
    from models import Transaction, Product, Shop
    txs = Transaction.query.filter_by(customer_id=customer.id).order_by(Transaction.date.desc()).all()
    history = []
    for t in txs:
        product = Product.query.get(t.product_id)
        history.append({
            "id": t.id,
            "shop_name": t.shop.name if t.shop else "Unknown Shop",
            "total_amount": t.total_amount,
            "date": t.date.strftime('%Y-%m-%d %H:%M:%S'),
            "is_birthday_sale": bool(t.is_birthday_sale),
            "items": [{
                "product_name": product.name if product else "Unknown Product",
                "quantity": t.quantity,
                "price": t.unit_price
            }]
        })
    return jsonify(history), 200

@customer_bp.route('/offers', methods=['GET'])
@jwt_required()
def get_current_offers():
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer or not customer.shop_id:
        return jsonify([]), 200
        
    from datetime import datetime, timedelta
    today = datetime.now().date()
    soon = today + timedelta(days=7)
    
    # Products expiring soon get 20% discount
    products = Product.query.filter(
        Product.shop_id == customer.shop_id,
        Product.expiry_date != None,
        Product.expiry_date >= today,
        Product.expiry_date <= soon,
        Product.stock_quantity > 0
    ).all()
    
    offers = []
    for p in products:
        offers.append({
            "id": p.id,
            "name": p.name,
            "original_price": p.selling_price,
            "discounted_price": round(p.selling_price * 0.8, 2),
            "expiry_date": p.expiry_date.strftime('%Y-%m-%d'),
            "category": p.category
        })
    return jsonify(offers), 200

# Endpoint to trigger "Expiring Soon" Discount Email manually or automatically
@customer_bp.route('/notify-discount', methods=['POST'])
@jwt_required()
def notify_discount():
    print("DEBUG: /notify-discount endpoint HIT")
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    data = request.get_json()
    product_id = data.get('product_id')
    
    product = Product.query.get(product_id)
    if not product or product.shop_id != shop.id:
        return jsonify({"message": "Product not found"}), 404
        
    # Logic: If product is expiring soon, send blast email to all shop customers
    customers = Customer.query.filter_by(shop_id=shop.id).all()
    print(f"DEBUG: Found {len(customers)} customers for shop {shop.name}")
    
    email_count = 0
    for customer in customers:
        if customer.email:
            # Use selling_price instead of non-existent .price
            price = product.selling_price
            discounted_price = round(price * 0.8, 2)
            subject = f"Clearance Sale at {shop.name}: 20% OFF on {product.name}!"
            body = (
                f"Dear {customer.name},\n\n"
                f"Great news! We are having a clearance sale on {product.name}.\n\n"
                f"Remaining Stock: {product.stock_quantity} units only!\n\n"
                f"Price Drop:\n"
                f" - Original Price: INR {price}\n"
                f" - Your Price: INR {discounted_price} (20% OFF)\n\n"
                f"Hurry up! This offer is valid while stocks last.\n\n"
                f"Best Regards,\n"
                f"{shop.name} Team"
            )
            print(f"DEBUG: Attempting to email {customer.email}...")
            try:
                success = send_email(customer.email, subject, body)
                if success:
                    email_count += 1
                    print(f"DEBUG: Email SENT to {customer.email}")
                else:
                    print(f"DEBUG: Email FAILED for {customer.email}")
            except Exception as e:
                print(f"DEBUG: Email EXCEPTION for {customer.email}: {str(e)}")
            
    return jsonify({"message": f"Discount notification sent to {email_count} customers."}), 200

@customer_bp.route('/shop-products/<int:shop_id>', methods=['GET'])
@jwt_required()
def get_shop_products(shop_id):
    try:
        print(f"DEBUG: get_shop_products called for shop_id: {shop_id}")
        
        # Check if shop exists
        from models import Shop
        shop = Shop.query.get(shop_id)
        if not shop:
            return jsonify({"message": f"Shop with ID {shop_id} not found"}), 404

        # Using sqlalchemy.inspect to check for column existence safely
        from sqlalchemy import inspect
        mapper = inspect(Product)
        has_archived = "is_archived" in mapper.attrs
        
        query = Product.query.filter(Product.shop_id == shop_id)
        if has_archived:
            # PostgreSQL is strict: use only boolean or None check
            query = query.filter((Product.is_archived == False) | (Product.is_archived == None))
        
        products = query.all()
        print(f"DEBUG: Found {len(products)} products for shop {shop_id}")
        
        from services.gst_service import get_gst_rate
        result = []
        for p in products:
            try:
                gst_rate = get_gst_rate(p.name, p.category)
                # Basic product data
                p_data = {
                    "id": p.id,
                    "name": p.name,
                    "category": p.category,
                    "price": p.selling_price if hasattr(p, 'selling_price') else 0.0,
                    "gst_rate": gst_rate,
                    "stock": p.stock_quantity if hasattr(p, 'stock_quantity') else 0,
                    "unit_options": []
                }
                
                # Unit options
                if hasattr(p, 'unit_options') and p.unit_options:
                    for opt in p.unit_options:
                        p_data["unit_options"].append({
                            "id": opt.id,
                            "unit_type": opt.unit_type,
                            "unit_value": opt.unit_value,
                            "selling_price": opt.selling_price,
                            "stock_quantity": opt.stock_quantity
                        })
                
                result.append(p_data)
            except Exception as item_err:
                print(f"DEBUG: Skipping broken product ID {getattr(p, 'id', 'unknown')}: {item_err}")
                continue
                
        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server Error loading products: {str(e)}"}), 500

@customer_bp.route('/monthly-ration', methods=['GET'])
@jwt_required()
def get_monthly_ration():
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify({"message": "Customer profile not found"}), 404
    
    from services.gst_service import get_gst_rate
    rations = MonthlyRation.query.filter_by(customer_id=customer.id).all()
    result = []
    for r in rations:
        items = []
        for item in r.items:
            gst_rate = get_gst_rate(item.product.name, item.product.category)
            items.append({
                "product_id": item.product_id,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit": item.unit,
                "price": item.price if hasattr(item, 'price') and item.price else item.product.selling_price,
                "gst_rate": gst_rate,
                "unit_option_id": item.unit_option_id if hasattr(item, 'unit_option_id') else None
            })
        result.append({
            "id": r.id,
            "shop_id": r.shop_id,
            "shop_name": r.shop.name,
            "status": r.status,
            "items": items,
            "updated_at": r.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(result), 200

@customer_bp.route('/monthly-ration', methods=['POST'])
@jwt_required()
def save_monthly_ration():
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify({"message": "Customer profile not found"}), 404
    
    data = request.get_json()
    shop_id = data.get('shop_id')
    items_data = data.get('items', [])
    
    # Check if a ration already exists for this shop
    ration = MonthlyRation.query.filter_by(customer_id=customer.id, shop_id=shop_id).first()
    if not ration:
        ration = MonthlyRation(customer_id=customer.id, shop_id=shop_id)
        db.session.add(ration)
    
    # Clear existing items and add new ones
    MonthlyRationItem.query.filter_by(ration_id=ration.id).delete()
    
    for item in items_data:
        new_item = MonthlyRationItem(
            ration_id=ration.id,
            product_id=item['product_id'],
            quantity=item['quantity'],
            unit=item['unit'],
            unit_option_id=item.get('unit_option_id'),
            price=item.get('price')
        )
        db.session.add(new_item)
    
    db.session.commit()
    return jsonify({"message": "Monthly ration saved successfully", "id": ration.id}), 200

@customer_bp.route('/submit-ration', methods=['POST'])
@jwt_required()
def submit_ration():
    from models import BirthdayOffer
    from services.gst_service import get_gst_rate
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify({"message": "Customer profile not found"}), 404
    
    data = request.get_json()
    ration_id = data.get('ration_id')
    payment_method = data.get('payment_method', 'cod') # 'cod' or 'online'
    delivery_name = data.get('delivery_name')
    delivery_phone = data.get('delivery_phone')
    delivery_address = data.get('delivery_address')
    birthday_offer_code = data.get('birthday_offer_code')
    
    ration = MonthlyRation.query.get(ration_id)
    if not ration or ration.customer_id != customer.id:
        return jsonify({"message": "Ration plan not found"}), 404
    
    # Calculate total and check products
    total_amount = 0
    total_gst_amount = 0
    items_to_create = []
    for item in ration.items:
        product = Product.query.get(item.product_id)
        if not product: continue
        
        # Get correct price from variation if exists
        price = item.price if hasattr(item, 'price') and item.price else product.selling_price
        
        # Dynamic GST calculation
        gst_rate = get_gst_rate(product.name, product.category)
        item_subtotal = price * item.quantity
        item_gst = item_subtotal * gst_rate
        
        total_amount += item_subtotal
        total_gst_amount += item_gst
        
        items_to_create.append(MonthlyRationOrderItem(
            product_id=product.id,
            product_name=product.name,
            quantity=item.quantity,
            unit=item.unit,
            price_at_order=price,
            unit_option_id=item.unit_option_id if hasattr(item, 'unit_option_id') else None
        ))
    
    if not items_to_create:
        return jsonify({"message": "Ration plan is empty"}), 400

    # Handle Birthday Discount
    applied_discount = 0
    if birthday_offer_code:
        from datetime import date
        offer = BirthdayOffer.query.filter_by(
            offer_code=birthday_offer_code,
            customer_id=customer.id,
            shop_id=ration.shop_id,
            is_used=False
        ).filter(BirthdayOffer.valid_until >= date.today()).first()

        if offer and not offer.is_used:
            # Discount applied on subtotal before GST
            applied_discount = (total_amount * offer.discount_percent) / 100.0
            total_amount -= applied_discount
            # Apply discount to GST as well
            total_gst_amount -= (total_gst_amount * offer.discount_percent) / 100.0
            
            offer.is_used = True  # Only mark THIS specific offer as used (per-shop)
            print(f"DEBUG: Applied birthday discount of {offer.discount_percent}%: -INR {applied_discount}")
        else:
            print("DEBUG: Invalid or already used birthday offer code")

    grand_total = total_amount + total_gst_amount

    # Create the Order
    new_order = MonthlyRationOrder(
        customer_id=customer.id,
        shop_id=ration.shop_id,
        total_amount=grand_total,
        payment_method=payment_method,
        payment_status='paid' if payment_method == 'online' else 'pending',
        delivery_status='pending',
        delivery_address=delivery_address or customer.address or "Not Provided",
        birthday_discount_applied = True if applied_discount > 0 else False
    )
    
    db.session.add(new_order)
    db.session.flush() # Get order ID
    
    for order_item in items_to_create:
        order_item.order_id = new_order.id
        db.session.add(order_item)
    
    # Update ration status
    ration.status = 'submitted'

    # Real-time stock deduction - for both online (paid immediately) and COD (deduct on delivery confirmation)
    try:
        from .inventory_routes import deduct_ration_stock
        # For online payment, deduct stock immediately. For COD, it will be deducted on delivery.
        if payment_method == 'online':
            success, msg = deduct_ration_stock(new_order.id)
            if success:
                print(f"DEBUG: Real-time stock deducted for order {new_order.id}")
            else:
                print(f"DEBUG: Stock deduction failed: {msg}")
    except Exception as e:
        print(f"DEBUG: Error in real-time stock deduction: {e}")

    db.session.commit()

    # Notify shop owner
    try:
        if ration.shop and ration.shop.owner:
            shop_owner_email = ration.shop.owner.email
            subject = f"NEW RATION ORDER: {delivery_name or customer.name}"
            body = f"Customer {delivery_name or customer.name} has placed a monthly ration order.\nSubtotal: INR {total_amount:.2f}\nGST: INR {total_gst_amount:.2f}\nTotal: INR {grand_total:.2f}\nPayment: {payment_method.upper()}\nPhone: {delivery_phone or customer.phone}\nAddress: {new_order.delivery_address}\n\nPlease check your dashboard to process delivery."
            send_email(shop_owner_email, subject, body)
            print(f"DEBUG: Notified shop owner {shop_owner_email}")
        else:
            print("DEBUG: Shop or owner not found for notification")
    except Exception as e:
        print(f"DEBUG: Error notifying shop: {e}")

    print(f"DEBUG: Order {new_order.id} placed successfully")
    return jsonify({
        "message": "Order placed successfully!",
        "order_id": new_order.id,
        "bill": {
            "order_id": new_order.id,
            "subtotal": total_amount,
            "gst_amount": total_gst_amount,
            "total": grand_total,
            "payment": payment_method,
            "address": new_order.delivery_address,
            "name": delivery_name or customer.name,
            "phone": delivery_phone or customer.phone
        }
    }), 200

@customer_bp.route('/my-ration-orders', methods=['GET'])
@jwt_required()
def get_my_ration_orders():
    current_user = get_jwt_identity()
    customer = Customer.query.filter_by(user_id=current_user['id']).first()
    if not customer:
        return jsonify([]), 200
        
    orders = MonthlyRationOrder.query.filter_by(customer_id=customer.id).order_by(MonthlyRationOrder.created_at.desc()).all()
    result = []
    for o in orders:
        items = []
        for item in o.items:
            # Find the unit value and type if it's a variation
            unit_display = item.unit
            if item.unit_option_id:
                from models import ProductUnitOption
                opt = ProductUnitOption.query.get(item.unit_option_id)
                if opt:
                    unit_display = f"{opt.unit_value} {opt.unit_type}"

            items.append({
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit": unit_display,
                "price": item.price_at_order
            })
        result.append({
            "id": o.id,
            "shop_name": o.shop.name,
            "total_amount": o.total_amount,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "delivery_status": o.delivery_status,
            "items": items,
            "is_birthday_sale": bool(getattr(o, 'birthday_discount_applied', False)),
            "date": o.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(result), 200

@customer_bp.route('/shop/ration-orders', methods=['GET'])
@jwt_required()
def get_shop_ration_orders():
    current_user = get_jwt_identity()
    # Find shop owned by this user
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify([]), 200
        
    orders = MonthlyRationOrder.query.filter_by(shop_id=shop.id).order_by(MonthlyRationOrder.created_at.desc()).all()
    
    result = []
    for o in orders:
        items = [{
            "name": i.product_name,
            "quantity": i.quantity,
            "unit": i.unit,
            "price": i.price_at_order
        } for i in o.items]
        
        result.append({
            "id": o.id,
            "customer_name": o.customer_rel.name,
            "customer_phone": o.customer_rel.phone,
            "total_amount": o.total_amount,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "delivery_status": o.delivery_status,
            "delivery_address": o.delivery_address,
            "created_at": o.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "items": items
        })
    return jsonify(result), 200

@customer_bp.route('/order/<int:order_id>/status', methods=['PATCH'])
@jwt_required()
def update_order_status(order_id):
    data = request.get_json()
    new_status = data.get('delivery_status')
    new_payment_status = data.get('payment_status')
    
    order = MonthlyRationOrder.query.get(order_id)
    if not order:
        return jsonify({"message": "Order not found"}), 404
        
    if new_status:
        order.delivery_status = new_status
    if new_payment_status:
        # If order was not paid but now is being marked as paid, deduct stock
        if order.payment_status != 'paid' and new_payment_status == 'paid':
            try:
                from .inventory_routes import deduct_ration_stock
                success, msg = deduct_ration_stock(order.id)
                if success:
                    print(f"DEBUG: Real-time stock deducted for order {order.id} on payment update")
                else:
                    print(f"DEBUG: Stock deduction failed on payment update: {msg}")
            except Exception as e:
                print(f"DEBUG: Error in stock deduction on payment update: {e}")
        order.payment_status = new_payment_status
        
    db.session.commit()
    return jsonify({"message": "Order status updated"}), 200
