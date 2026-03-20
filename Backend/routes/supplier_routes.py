from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Product, Shop, Supplier, db, Transaction, SupplyRequest, SupplierCatalog, SupplierCatalogVariation, User, SupplierQuote, SupplierBill
from services.notification_service import send_email
from services.matching_service import find_catalog_match
from datetime import datetime

supplier_bp = Blueprint('supplier', __name__)

@supplier_bp.route('/requests', methods=['GET'])
@jwt_required()
def get_supply_requests():
    try:
        current_user = get_jwt_identity()
        user_id = current_user['id']
        supplier = Supplier.query.filter_by(user_id=user_id).first()
        if not supplier:
            return jsonify([]), 200
            
        # Find the "Most Orders" shop for this supplier
        from sqlalchemy import func
        top_shop = db.session.query(SupplierBill.shop_id, func.count(SupplierBill.id).label('order_count')) \
            .filter(SupplierBill.supplier_id == supplier.id, SupplierBill.status == 'Paid') \
            .group_by(SupplierBill.shop_id) \
            .order_by(func.count(SupplierBill.id).desc()) \
            .first()
        
        top_shop_id = top_shop[0] if top_shop else None
            
        # 1. GET LINKED SHOPS
        linked_shop_ids = [shop.id for shop in supplier.shops]
        if not linked_shop_ids:
            return jsonify([]), 200
            
        # 2. FETCH ONLY REQUESTS FROM THESE SHOPS
        # Filter strictly by shop_id to avoid showing requests from unlinked shops
        requests = SupplyRequest.query.filter(SupplyRequest.shop_id.in_(linked_shop_ids)).all()
        
        # LOGGING: Verify requests filtered
        print(f"DEBUG: Found {len(requests)} total requests for linked shops {linked_shop_ids}")
        
        result = []
        for req in requests:
            # 3. CHECK CATALOG MATCH (Flexible)
            catalog_item = find_catalog_match(supplier.id, req.product.sku, req.product.name)
            
            can_quote = req.status in ['Pending', 'Quotes Received', 'Awaiting Approval', 'Awaiting Selection']
            
            # VARIATION PRICE MATCHING for display
            display_base_price = 0.0
            in_catalog = False
            
            if catalog_item:
                in_catalog = True
                display_base_price = catalog_item.base_price
                if req.unit_type and req.unit_value:
                    variation_match = next((v for v in catalog_item.variations 
                                          if v.unit_type == req.unit_type and v.unit_value == req.unit_value), None)
                    if variation_match:
                        display_base_price = variation_match.base_price

            # 4. Check for existing quote
            existing_quote = SupplierQuote.query.filter_by(
                supply_request_id=req.id, 
                supplier_id=supplier.id
            ).first()
            
            if existing_quote:
                can_quote = False

            result.append({
                "id": req.id,
                "shop_id": req.shop_id,
                "shop_name": req.shop.name,
                "product_name": req.product.name,
                "product_sku": req.product.sku,
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
                "my_quote_status": existing_quote.status if existing_quote else None,
                "my_quote_gst": existing_quote.gst_amount if existing_quote else 0.0,
                "my_quote_grand_total": existing_quote.grand_total if existing_quote else 0.0,
                "is_winner": existing_quote.status == 'Accepted' if existing_quote else False,
                "is_top_customer": req.shop_id == top_shop_id if top_shop_id else False
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
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
        
    req = SupplyRequest.query.get_or_404(req_id)
    
    # Check if this supplier is the one assigned to this request
    if req.supplier_id != supplier.id:
        return jsonify({"message": "You are not the assigned supplier for this order."}), 403
        
    data = request.get_json()
    new_status = data.get('status')
    
    if new_status:
        # Check if new status is valid for current state
        if new_status == 'Shipped' and req.status != 'Paid':
            return jsonify({"message": "You must wait for payment before shipping."}), 400
        if new_status == 'Delivered' and req.status != 'Shipped':
            return jsonify({"message": "You must ship the order before delivering it."}), 400
            
        req.status = new_status
        if new_status == 'Delivered':
            # Auto-restock product when delivered
            product = Product.query.get(req.product_id)
            if product:
                # 1. Update Variation Stock if applicable
                if req.unit_type and req.unit_value:
                    from models import ProductUnitOption
                    opt = ProductUnitOption.query.filter_by(
                        product_id=product.id,
                        unit_type=req.unit_type,
                        unit_value=req.unit_value
                    ).first()
                    if opt:
                        opt.stock_quantity += req.quantity_needed
                        print(f"DEBUG: Restocked variation {opt.unit_value} {opt.unit_type} by {req.quantity_needed}")
                
                # 2. Update main product stock (always increment for total tracking)
                product.stock_quantity += req.quantity_needed
                
                # UN-ARCHIVE if it was expired/archived
                product.is_archived = False
                
                # CLEANUP: Remove from ExpiredProduct table if it exists
                from models import ExpiredProduct
                ExpiredProduct.query.filter_by(product_id=product.id, shop_id=product.shop_id).delete()
                
                # 3. FORCE REFRESH total stock from all variations to be 100% sure
                if product.unit_options:
                    product.stock_quantity = sum(o.stock_quantity for o in product.unit_options)
                
                db.session.add(product)
                db.session.commit()
                print(f"DEBUG: Final stock for {product.name} after delivery: {product.stock_quantity}")
            
            # Update Expiry Date if provided
            new_expiry = data.get('new_expiry_date')
            if new_expiry:
                try:
                    product.expiry_date = datetime.strptime(new_expiry, '%Y-%m-%d').date()
                except ValueError: pass
            
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
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
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
        
        if unit_price <= 0:
            return jsonify({"message": "Invalid base price in catalog"}), 400
            
        total = unit_price * req.quantity_needed * (1 - discount_percent/100)
        
        # Calculate GST (18% for India)
        gst_amount = total * 0.18
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
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
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
    body = request.get_json() or {}
    supplier_id = body.get('supplier_id')
    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
    if supplier not in shop.suppliers:
        shop.suppliers.append(supplier)
        db.session.commit()
        if supplier.user and supplier.user.email:
            subject = "You have been added as a supplier"
            content = f"{shop.name} has added you as a supplier."
            try:
                send_email(supplier.user.email, subject, content)
            except Exception:
                pass
    return jsonify({"message": "Supplier assigned to shop"}), 200

@supplier_bp.route('/catalog', methods=['GET'])
@jwt_required()
def get_catalog():
    current_user = get_jwt_identity()
    if current_user['role'] != 'supplier':
        return jsonify([]), 200
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
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
        supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
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
