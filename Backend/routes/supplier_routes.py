from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Product, Shop, Supplier, db, Transaction, SupplyRequest, SupplierCatalog, SupplierCatalogVariation, User, SupplierQuote, SupplierBill
from services.notification_service import send_email
from services.matching_service import find_catalog_match
from datetime import datetime

supplier_bp = Blueprint('supplier', __name__)

def get_supplier_for_user(user_id):
    """Helper to find a supplier record linked to a user_id, with robust recovery logic."""
    from models import User as UserTable, SupplierCatalog, SupplierBill
    user = UserTable.query.get(user_id)
    if not user:
        return None

    # 1. Direct link (Primary)
    supplier = Supplier.query.filter_by(user_id=user_id).first()
    
    # 2. Recovery Logic: If no supplier found OR if the found supplier is "empty"
    # (Empty = no catalog, no linked shops, no bills)
    is_new_empty = False
    if supplier:
        has_catalog = SupplierCatalog.query.filter_by(supplier_id=supplier.id).first() is not None
        has_shops = len(supplier.shops) > 0
        has_bills = SupplierBill.query.filter_by(supplier_id=supplier.id).first() is not None
        if not (has_catalog or has_shops or has_bills):
            is_new_empty = True
            print(f"DEBUG: Found supplier {supplier.id} for user {user_id} but it's empty. Checking for old records...")

    if not supplier or is_new_empty:
        # Search for an orphaned supplier record that matches this user's details
        # Check by email or phone first (via User table join or direct search)
        orphaned = Supplier.query.filter(
            (Supplier.user_id == None) | (Supplier.user_id != user_id)
        ).filter(
            (Supplier.company_name == user.name) | 
            (Supplier.contact_person == user.name)
        ).first()

        if not orphaned:
            # Fallback to email/phone match
            orphaned = Supplier.query.join(UserTable).filter(
                (UserTable.email == user.email) | (UserTable.phone == user.phone)
            ).filter(Supplier.id != (supplier.id if supplier else -1)).first()

        if orphaned:
            print(f"DEBUG: Recovering orphaned supplier record {orphaned.id} for user {user_id}")
            # If we had an empty new supplier, we should ideally merge or delete it
            if supplier and is_new_empty:
                # Re-link everything from new to old if necessary, but here we just switch
                db.session.delete(supplier)
                db.session.flush()
            
            orphaned.user_id = user.id
            db.session.commit()
            return orphaned

    return supplier

@supplier_bp.route('/requests', methods=['GET'])
@jwt_required()
def get_supply_requests():
    try:
        current_user = get_jwt_identity()
        user_id = current_user.get('id')
        role = current_user.get('role')
        
        print(f"DEBUG: get_supply_requests called for user_id: {user_id}, role: {role}")
        
        supplier = get_supplier_for_user(user_id)
        if not supplier:
            print(f"DEBUG: No supplier record found for user_id: {user_id}")
            return jsonify([]), 200
            
        print(f"DEBUG: Found supplier: {supplier.company_name} (ID: {supplier.id})")
            
        # Find the "Most Orders" shop for this supplier
        from sqlalchemy import func
        top_shop = db.session.query(SupplierBill.shop_id, func.count(SupplierBill.id).label('order_count')) \
            .filter(SupplierBill.supplier_id == supplier.id, SupplierBill.status == 'Paid') \
            .group_by(SupplierBill.shop_id) \
            .order_by(func.count(SupplierBill.id).desc()) \
            .first()
        
        top_shop_id = top_shop[0] if top_shop else None
            
        # 1. GET LINKED SHOPS
        linked_shop_ids = [s.id for s in supplier.shops]
        print(f"DEBUG: Linked shops: {linked_shop_ids}")
        
        # 2. FETCH REQUESTS
        # PERMISSIVE: Show if:
        # a) Request is specifically assigned to this supplier (regardless of status)
        # b) Shop is linked to this supplier (regardless of status)
        # c) Request is "Public" (no supplier assigned) AND matches catalog AND is in an active quoting state
        from sqlalchemy import or_
        
        # Query A & B: Assigned or Linked
        requests = SupplyRequest.query.filter(
            or_(
                SupplyRequest.shop_id.in_(linked_shop_ids) if linked_shop_ids else False,
                SupplyRequest.supplier_id == supplier.id
            )
        ).all()
        
        # Query C: Public Matching Catalog
        # We include MORE statuses here to be safe
        active_quoting_statuses = ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection', 'Awaiting Payment', 'Paid', 'Shipped']
        public_requests = SupplyRequest.query.filter(
            SupplyRequest.supplier_id == None,
            SupplyRequest.status.in_(active_quoting_statuses)
        ).all()
        
        for pr in public_requests:
            # Avoid duplicates if already added via shop link
            if any(r.id == pr.id for r in requests):
                continue
                
            # Check if supplier sells this product
            p_name = pr.product.name if pr.product else ""
            p_sku = pr.product.sku if pr.product else ""
            if find_catalog_match(supplier.id, p_sku, p_name):
                requests.append(pr)
        
        print(f"DEBUG: Found {len(requests)} total requests after filtering")
        for r in requests:
            print(f"  - Request ID: {r.id}, Shop ID: {r.shop_id}, Status: {r.status}, Supplier ID: {r.supplier_id}")
        
        result = []
        for req in requests:
            # DEFENSIVE ACCESS: If product or shop is missing, use placeholders instead of skipping
            # This ensures the supplier still sees the request even if the data is slightly broken
            p_name = "Unknown Product"
            p_sku = "N/A"
            s_name = "Unknown Shop"
            
            if req.product:
                p_name = req.product.name
                p_sku = req.product.sku
            else:
                print(f"DEBUG: Request {req.id} has missing product (ID: {req.product_id})")
                
            if req.shop:
                s_name = req.shop.name
            else:
                print(f"DEBUG: Request {req.id} has missing shop (ID: {req.shop_id})")

            # 3. CHECK CATALOG MATCH (Flexible)
            # Only attempt match if product exists
            in_catalog = False
            display_base_price = 0.0
            
            if req.product:
                catalog_item = find_catalog_match(supplier.id, p_sku, p_name)
                if catalog_item:
                    in_catalog = True
                    display_base_price = catalog_item.base_price
                    if req.unit_type and req.unit_value:
                        variation_match = next((v for v in catalog_item.variations 
                                              if v.unit_type == req.unit_type and v.unit_value == req.unit_value), None)
                        if variation_match:
                            display_base_price = variation_match.base_price
            
            can_quote = req.status in ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection']

            # 4. Check for existing quote
            existing_quote = SupplierQuote.query.filter_by(
                supply_request_id=req.id, 
                supplier_id=supplier.id
            ).first()
            
            if existing_quote:
                can_quote = False

            # Determine the display status for "Your Quote"
            my_quote_status = existing_quote.status if existing_quote else None
            my_quote_gst = existing_quote.gst_amount if existing_quote else 0.0
            my_quote_grand_total = existing_quote.grand_total if existing_quote else 0.0

            result.append({
                "id": req.id,
                "shop_id": req.shop_id,
                "shop_name": s_name,
                "product_id": req.product_id,
                "product_name": p_name,
                "product_sku": p_sku,
                "quantity": req.quantity_needed,
                "unit_type": req.unit_type,
                "unit_value": req.unit_value,
                "status": req.status,
                "reason": req.reason,
                "request_date": req.request_date.strftime('%Y-%m-%d'),
                "delivery_date": req.delivery_date.strftime('%Y-%m-%d') if req.delivery_date else 'Not Scheduled',
                "in_catalog": in_catalog,
                "base_price": display_base_price,
                "can_quote": can_quote,
                "has_quoted": existing_quote is not None,
                "my_quote_status": my_quote_status,
                "my_quote_gst": my_quote_gst,
                "my_quote_grand_total": my_quote_grand_total,
                "is_winner": existing_quote.status == 'Accepted' if existing_quote else False,
                "is_top_customer": req.shop_id == top_shop_id if top_shop_id else False,
                "expiry_date": req.expiry_date.strftime('%Y-%m-%d') if req.expiry_date else None,
                "gst_rate": get_gst_rate(p_name, req.product.category if req.product else None)
            })
            
        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"message": str(e)}), 500

@supplier_bp.route('/requests/<int:req_id>/update', methods=['POST'])
@jwt_required()
def update_request_status(req_id):
    current_user = get_jwt_identity()
    supplier = get_supplier_for_user(current_user['id'])
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
        
    req = SupplyRequest.query.get_or_404(req_id)
    
    # Check if this supplier is the one assigned to this request
    if req.supplier_id != supplier.id:
        return jsonify({"message": "You are not the assigned supplier for this order."}), 403
        
    data = request.get_json()
    new_status = data.get('status')
    new_expiry = data.get('expiry_date') # Allow supplier to update expiry during delivery
    
    if new_status:
        # Check if new status is valid for current state
        if new_status == 'Shipped' and req.status != 'Paid':
            return jsonify({"message": "You must wait for payment before shipping."}), 400
        if new_status == 'Delivered' and req.status != 'Shipped':
            return jsonify({"message": "You must ship the order before delivering it."}), 400
            
        # Update expiry if provided during any status update
        if new_expiry:
            from datetime import datetime as dt
            try:
                req.expiry_date = dt.strptime(new_expiry, '%Y-%m-%d').date()
                print(f"DEBUG: Updated request expiry to {req.expiry_date} during delivery")
            except Exception as e:
                print(f"DEBUG: Invalid expiry format provided: {e}")

        req.status = new_status
        if new_status == 'Delivered':
            # Auto-restock product when delivered
            product = Product.query.get(req.product_id)
            if product:
                from models import ProductBatch, ProductUnitOption
                
                # 1. Update Variation Stock if applicable
                unit_option = None
                if req.unit_type and req.unit_value:
                    unit_option = ProductUnitOption.query.filter_by(
                        product_id=product.id,
                        unit_type=req.unit_type,
                        unit_value=req.unit_value
                    ).first()
                    if unit_option:
                        unit_option.stock_quantity += req.quantity_needed
                        print(f"DEBUG: Restocked variation {unit_option.unit_value} {unit_option.unit_type} by {req.quantity_needed}")
                
                # 2. Update main product stock (always increment for total tracking)
                product.stock_quantity += req.quantity_needed
                
                # 3. CREATE NEW BATCH (FIFO support)
                # Use the latest expiry_date (either from quote or updated during delivery)
                batch_expiry = req.expiry_date
                new_batch = ProductBatch(
                    product_id=product.id,
                    unit_option_id=unit_option.id if unit_option else None,
                    quantity=req.quantity_needed,
                    expiry_date=batch_expiry
                )
                db.session.add(new_batch)
                print(f"DEBUG: Created new batch for {product.name} with expiry {batch_expiry}")

                # UN-ARCHIVE if it was expired/archived
                product.is_archived = False
                
                # CLEANUP: Remove from ExpiredProduct table if it exists
                from models import ExpiredProduct
                ExpiredProduct.query.filter_by(product_id=product.id, shop_id=product.shop_id).delete()
                
                # 4. FORCE REFRESH total stock from all variations to be 100% sure
                if product.unit_options:
                    product.stock_quantity = sum(o.stock_quantity for o in product.unit_options)
                
                # 5. Update main product's "latest" expiry date (as fallback)
                if batch_expiry:
                    product.expiry_date = batch_expiry
                    print(f"DEBUG: Updated product {product.name} primary expiry date to {product.expiry_date}")
                
                db.session.add(product)
                db.session.commit()
                print(f"DEBUG: Final stock for {product.name} after delivery: {product.stock_quantity}")
            
            # Log Transaction
            trans = Transaction(
                product_id=product.id,
                shop_id=product.shop_id,
                transaction_type='RESTOCK',
                quantity=req.quantity_needed,
                unit_type=req.unit_type,
                unit_value=req.unit_value
            )
            db.session.add(trans)
            req.delivery_date = datetime.utcnow()
            
    db.session.commit()
    return jsonify({"message": f"Request updated to {new_status}"}), 200

@supplier_bp.route('/requests/<int:req_id>/quote', methods=['POST'])
@jwt_required()
def submit_quote(req_id):
    current_user = get_jwt_identity()
    supplier = get_supplier_for_user(current_user['id'])
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
    req = SupplyRequest.query.get(req_id)
    if not req:
        return jsonify({"message": "Request not found"}), 404
    
    # Check if this supplier has already submitted a quote for this request
    existing_quote = SupplierQuote.query.filter_by(
        supply_request_id=req.id, 
        supplier_id=supplier.id
    ).first()
    if existing_quote:
        return jsonify({"message": "You have already submitted a quote for this request."}), 400

    body = request.get_json() or {}
    try:
        # Fetch base price from supplier's catalog for this product using flexible matching
        product = Product.query.get(req.product_id)
        catalog_item = find_catalog_match(supplier.id, product.sku, product.name)
        
        if not catalog_item:
            return jsonify({"message": "Product not found in your catalog. Please add it first with a base price."}), 400
            
        unit_price = catalog_item.base_price
        
        # VARIATION PRICE MATCHING
        if req.unit_type and req.unit_value:
            # Look for matching variation in catalog item
            variation_match = next((v for v in catalog_item.variations 
                                  if v.unit_type == req.unit_type and v.unit_value == req.unit_value), None)
            if variation_match:
                unit_price = variation_match.base_price
                print(f"DEBUG: Found variation match for {req.unit_value} {req.unit_type}. Using price: {unit_price}")
            else:
                print(f"DEBUG: No exact variation match found for {req.unit_value} {req.unit_type}. Using base price: {unit_price}")

        discount_percent = float(body.get('discount_percent', 0))
        expiry_date_str = body.get('expiry_date') # Expiry date for this batch
        
        expiry_date = None
        if expiry_date_str:
            try:
                expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        if unit_price <= 0:
            return jsonify({"message": "Invalid base price in catalog"}), 400
            
        total = unit_price * req.quantity_needed * (1 - discount_percent/100)
        
        # Calculate GST based on Indian GST Rules
        from services.gst_service import get_gst_rate
        gst_rate = get_gst_rate(product.name, product.category)
        gst_amount = total * gst_rate
        grand_total = total + gst_amount

        existing_count = SupplierQuote.query.filter_by(supply_request_id=req.id).count()
        q = SupplierQuote(
            supply_request_id=req.id,
            shop_id=req.shop_id,
            product_id=req.product_id,
            supplier_id=supplier.id,
            unit_price=unit_price,
            discount_percent=discount_percent,
            total=total,
            gst_amount=gst_amount,
            grand_total=grand_total,
            expiry_date=expiry_date,
            status='Offered'
        )
        db.session.add(q)
        # Update request status to reflect that quotes are waiting for selection
        if req.status in ['Pending', 'Quotes Received', 'Awaiting Approval']:
            req.status = 'Awaiting Selection'
        db.session.commit()
        return jsonify({"message": "Quote submitted", "id": q.id, "status": q.status}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Invalid data: {str(e)}"}), 400

@supplier_bp.route('/list', methods=['GET'])
@jwt_required()
def list_suppliers():
    current_user = get_jwt_identity()
    suppliers = Supplier.query.all()
    data = []
    for s in suppliers:
        email = s.user.email if s.user else None
        phone = s.user.phone if s.user else None
        address = s.user.address if s.user else None
        data.append({
            "id": s.id, 
            "name": s.company_name, 
            "company_name": s.company_name, 
            "contact": s.contact_person,
            "contact_person": s.contact_person, 
            "email": email,
            "phone": phone,
            "address": address
        })
    print(f"DEBUG: Returning {len(data)} suppliers")
    return jsonify(data), 200

@supplier_bp.route('/linked-shops', methods=['GET'])
@jwt_required()
def linked_shops():
    current_user = get_jwt_identity()
    supplier = get_supplier_for_user(current_user['id'])
    if not supplier:
        return jsonify([]), 200
    result = []
    for shop in supplier.shops:
        result.append({"id": shop.id, "name": shop.name})
    return jsonify(result), 200

@supplier_bp.route('/linked-for-shop', methods=['GET'])
@jwt_required()
def linked_suppliers_for_shop():
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify([]), 200
    data = []
    for s in shop.suppliers:
        email = s.user.email if s.user else None
        phone = s.user.phone if s.user else None
        address = s.user.address if s.user else None
        data.append({
            "id": s.id, 
            "name": s.company_name, 
            "company_name": s.company_name, 
            "contact": s.contact_person,
            "contact_person": s.contact_person, 
            "email": email,
            "phone": phone,
            "address": address
        })
    print(f"DEBUG: Returning {len(data)} linked suppliers for shop {shop.id}")
    return jsonify(data), 200

@supplier_bp.route('/assign', methods=['POST'])
@jwt_required()
def assign_supplier():
    current_user = get_jwt_identity()
    if current_user['role'] != 'shop_owner':
        return jsonify({"message": "Unauthorized"}), 403
    
    data = request.get_json() or {}
    supplier_id = data.get('supplier_id')
    
    if not supplier_id:
        return jsonify({"message": "Supplier ID is required"}), 400
        
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
        
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    if supplier not in shop.suppliers:
        shop.suppliers.append(supplier)
        db.session.commit()
        
        # Notify supplier
        if supplier.user and supplier.user.email:
            try:
                send_email(
                    supplier.user.email,
                    "New Shop Connection",
                    f"Shop '{shop.name}' has added you as their supplier. You can now see their restock requests."
                )
            except Exception as e:
                print(f"Notification error: {e}")
                
    return jsonify({"message": f"Supplier '{supplier.company_name}' successfully linked to your shop"}), 200

@supplier_bp.route('/catalog', methods=['GET'])
@jwt_required()
def get_catalog():
    current_user = get_jwt_identity()
    if current_user['role'] != 'supplier':
        return jsonify([]), 200
    supplier = get_supplier_for_user(current_user['id'])
    if not supplier:
        return jsonify([]), 200
    items = SupplierCatalog.query.filter_by(supplier_id=supplier.id).all()
    res = []
    for it in items:
        variations = []
        for v in it.variations:
            variations.append({
                "id": v.id,
                "unit_type": v.unit_type,
                "unit_value": v.unit_value,
                "base_price": v.base_price
            })
            
        res.append({
            "id": it.id,
            "sku": it.sku,
            "name": it.name,
            "category": it.category,
            "base_price": it.base_price,
            "expiry_date": it.expiry_date.strftime('%Y-%m-%d') if it.expiry_date else None,
            "shelf_life_days": it.shelf_life_days,
            "discount_percent": it.discount_percent,
            "variations": variations
        })
    return jsonify(res), 200

@supplier_bp.route('/catalog', methods=['POST'])
@jwt_required()
def add_catalog_item():
    print("\n" + "="*50)
    print("CRITICAL DEBUG: add_catalog_item called!")
    try:
        current_user = get_jwt_identity()
        if current_user['role'] != 'supplier':
            return jsonify({"message": "Unauthorized"}), 403
        supplier = get_supplier_for_user(current_user['id'])
        if not supplier:
            return jsonify({"message": "Supplier not found"}), 404
        data = request.get_json() or {}
        print(f"DEBUG: Received Data: {data}")
        
        sku = data.get('sku')
        name = data.get('name')
        category = data.get('category')
        shelf_life_days = int(data.get('shelf_life_days')) if data.get('shelf_life_days') else None
        discount_percent = float(data.get('discount_percent', 0))
        expiry_date_str = data.get('expiry_date')
        
        # Variations data
        variations_data = data.get('variations', [])
        print(f"DEBUG: Variations found: {len(variations_data)}")
        
        expiry_date = None
        if expiry_date_str:
            try:
                expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d').date()
            except ValueError:
                expiry_date = None
                
        if not sku or not name:
            return jsonify({"message": "SKU and Name are required"}), 400
            
        # Default base price from first variation if variations exist
        default_base_price = 0.0
        if variations_data:
            try:
                default_base_price = float(variations_data[0].get('base_price', 0))
            except: pass
        else:
            default_base_price = float(data.get('base_price', 0))

        item = SupplierCatalog(
            supplier_id=supplier.id,
            sku=sku,
            name=name,
            category=category,
            base_price=default_base_price,
            expiry_date=expiry_date,
            shelf_life_days=shelf_life_days,
            discount_percent=discount_percent
        )
        db.session.add(item)
        db.session.flush() # Get item ID
        print(f"DEBUG: Catalog Item created with ID: {item.id}")
        
        # Add variations
        for v in variations_data:
            try:
                new_var = SupplierCatalogVariation(
                    catalog_item_id=item.id,
                    unit_type=v.get('unit_type', 'units'),
                    unit_value=float(v.get('unit_value', 1)),
                    base_price=float(v.get('base_price', 0))
                )
                db.session.add(new_var)
                print(f"DEBUG: Added variation: {new_var.unit_value} {new_var.unit_type}")
            except Exception as ve:
                print(f"DEBUG: Error adding variation: {ve}")
                continue
                
        db.session.commit()
        print("DEBUG: Database commit successful!")
        return jsonify({"message": "Catalog item added", "id": item.id}), 201
    except Exception as e:
        db.session.rollback()
        print(f"CRITICAL ERROR in add_catalog_item: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": str(e)}), 500
