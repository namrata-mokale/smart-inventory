from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Salesman, Shop, Transaction, Product
from datetime import datetime, date
from sqlalchemy import func

salesman_bp = Blueprint('salesman', __name__)

@salesman_bp.route('/register', methods=['POST'])
@jwt_required()
def register_salesman():
    current_user = get_jwt_identity()
    if current_user['role'] != 'shop_owner':
        return jsonify({"message": "Unauthorized"}), 403
    
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
    
    data = request.get_json()
    name = data.get('name')
    phone = data.get('phone')
    
    if not all([name, phone]):
        return jsonify({"message": "Missing required fields"}), 400
        
    if not phone.isdigit() or len(phone) != 10:
        return jsonify({"message": "Phone must be 10 digits"}), 400
        
    # AUTO-GENERATE UNIQUE SALESMAN ID
    import random, string
    while True:
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        salesman_id_code = f"SM-{random_suffix}"
        if not Salesman.query.filter_by(salesman_id_code=salesman_id_code).first():
            break
            
    new_salesman = Salesman(
        name=name,
        phone=phone,
        salesman_id_code=salesman_id_code,
        shop_id=shop.id
    )
    db.session.add(new_salesman)
    db.session.commit()
    
    return jsonify({"message": "Salesman registered successfully", "id": new_salesman.id}), 201

@salesman_bp.route('/me', methods=['GET'])
@jwt_required()
def get_salesman_profile():
    try:
        current_user = get_jwt_identity()
        user_id = current_user['id']
        salesman = Salesman.query.filter_by(user_id=user_id).first()
        
        # AUTO-LINK: If profile not found by user_id, try by email or phone
        if not salesman:
            from models import User
            user = User.query.get(user_id)
            if user and user.role == 'salesman':
                # Try linking by email first
                salesman = Salesman.query.filter_by(email=user.email).first()
                if not salesman:
                    # Try linking by phone
                    salesman = Salesman.query.filter_by(phone=user.phone).first()
                
                if salesman:
                    # Found a matching profile! Link it permanently
                    salesman.user_id = user.id
                    db.session.commit()
        
        if not salesman:
            return jsonify({"message": "Salesman profile not found. Please contact Shop Owner to be registered."}), 404
            
        # Calculate today's sales quantity (Using UTC date to match recorded transactions)
        from datetime import datetime
        today_utc = datetime.utcnow().date()
        daily_qty = db.session.query(func.sum(Transaction.quantity)).filter(
            Transaction.salesman_id == salesman.id,
            Transaction.transaction_type == 'SALE',
            func.date(Transaction.date) == today_utc
        ).scalar() or 0
        
        # Calculate current month's incentives (Using UTC date for consistency)
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_incentives = db.session.query(func.sum(Transaction.incentive_amount)).filter(
            Transaction.salesman_id == salesman.id,
            Transaction.transaction_type == 'SALE',
            Transaction.date >= start_of_month
        ).scalar() or 0.0
        
        # Estimated monthly salary (Base 15,000 + Monthly Incentives)
        estimated_salary = 15000 + monthly_incentives
        
        return jsonify({
            "id": salesman.id,
            "name": salesman.name,
            "phone": salesman.phone,
            "email": salesman.email,
            "gender": salesman.gender,
            "account_number": salesman.account_number,
            "salesman_id_code": salesman.salesman_id_code,
            "daily_sales_qty": daily_qty,
            "incentives": round(monthly_incentives, 2),
            "estimated_salary": round(estimated_salary, 2),
            "shop_id": salesman.shop_id,
            "shop_name": salesman.shop.name if salesman.shop else "Unknown Shop"
        }), 200
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"message": str(e)}), 500

@salesman_bp.route('/list', methods=['GET'])
@jwt_required()
def list_salesmen():
    current_user = get_jwt_identity()
    user_id = current_user['id']
    role = current_user['role']
    
    shop_id = None
    if role == 'shop_owner':
        shop = Shop.query.filter_by(owner_id=user_id).first()
        if shop: shop_id = shop.id
    elif role == 'salesman':
        salesman = Salesman.query.filter_by(user_id=user_id).first()
        if salesman: 
            shop_id = salesman.shop_id
        else:
            shop_id = current_user.get('shop_id')
        
    if not shop_id:
        return jsonify([]), 200
        
    salesmen = Salesman.query.filter_by(shop_id=shop_id).all()
    from datetime import datetime
    now = datetime.utcnow()
    today_utc = now.date()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    result = []
    for s in salesmen:
        # Calculate today's sales quantity for each salesman
        daily_qty = db.session.query(func.sum(Transaction.quantity)).filter(
            Transaction.salesman_id == s.id,
            Transaction.transaction_type == 'SALE',
            func.date(Transaction.date) == today_utc
        ).scalar() or 0
        
        # Calculate monthly incentives for each
        monthly_incentives = db.session.query(func.sum(Transaction.incentive_amount)).filter(
            Transaction.salesman_id == s.id,
            Transaction.transaction_type == 'SALE',
            Transaction.date >= start_of_month
        ).scalar() or 0.0
        
        result.append({
            "id": s.id,
            "name": s.name,
            "phone": s.phone,
            "email": s.email,
            "gender": s.gender,
            "account_number": s.account_number,
            "salesman_id_code": s.salesman_id_code,
            "daily_sales_qty": daily_qty,
            "incentives": round(monthly_incentives, 2),
            "estimated_salary": round(15000 + monthly_incentives, 2),
            "shop_id": s.shop_id
        })
    return jsonify(result), 200

@salesman_bp.route('/delete/<int:sid>', methods=['DELETE'])
@jwt_required()
def delete_salesman(sid):
    current_user = get_jwt_identity()
    shop = Shop.query.filter_by(owner_id=current_user['id']).first()
    s = Salesman.query.get_or_404(sid)
    if s.shop_id != shop.id:
        return jsonify({"message": "Unauthorized"}), 403
    db.session.delete(s)
    db.session.commit()
    return jsonify({"message": "Salesman deleted"}), 200
