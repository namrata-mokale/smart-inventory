from flask import Blueprint, request, jsonify
from models import db, User, Shop, Supplier, Customer, Salesman
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/shops', methods=['GET'])
def get_all_shops_public():
    shops = Shop.query.all()
    return jsonify([{"id": s.id, "name": s.name, "location": s.location} for s in shops]), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        print(f"DEBUG: Registering user {data.get('email')} with role {data.get('role')}")
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"message": "Email already exists"}), 400
            
        # Validate Phone Number (strictly 10 digits)
        phone = data.get('phone', '')
        if not phone.isdigit() or len(phone) != 10:
            return jsonify({"message": "Contact number must be exactly 10 digits"}), 400

        hashed_password = generate_password_hash(data['password'])
        
        new_user = User(
            name=data['name'],
            email=data['email'],
            password_hash=hashed_password,
            role=data['role'], # admin, shop_owner, supplier, customer, salesman
            phone=phone,
            address=data.get('address'),
            pincode=data.get('pincode')
        )
        
        db.session.add(new_user)
        db.session.flush() # Flush to get new_user.id without committing
        print(f"DEBUG: User object created with ID {new_user.id}")
        
        # If Shop Owner, create Shop
        if data['role'] == 'shop_owner':
            new_shop = Shop(
                name=data.get('shop_name', f"{data['name']}'s Shop"),
                owner_id=new_user.id,
                location=data.get('address') # Use address as location fallback
            )
            db.session.add(new_shop)
            print(f"DEBUG: Shop created for owner {new_user.id}")
        
        # If Supplier, create Supplier Profile
        elif data['role'] == 'supplier':
            new_supplier = Supplier(
                company_name=data.get('company_name', data['name']),
                user_id=new_user.id
            )
            db.session.add(new_supplier)
        
        # If Customer, create Customer Profile
        elif data['role'] == 'customer':
            import random
            import string
            unique_id = 'CUST-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            new_customer = Customer(
                customer_id_code=unique_id,
                name=data['name'],
                phone=phone,
                email=data['email'],
                address=data.get('address') or 'Not provided',
                dob=data.get('dob'),
                user_id=new_user.id
            )
            
            # Link to multiple shops
            shop_ids = data.get('shop_ids', [])
            if shop_ids:
                shops = Shop.query.filter(Shop.id.in_(shop_ids)).all()
                new_customer.shops.extend(shops)
                
            db.session.add(new_customer)
            print(f"DEBUG: Customer profile {unique_id} created with {len(shop_ids)} shops")
            
        # If Salesman, create Salesman Profile
        elif data['role'] == 'salesman':
            import random
            import string
            unique_id = 'SAL-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            
            shop_id = data.get('shop_id')
            if not shop_id:
                return jsonify({"message": "Shop selection is required for salesman"}), 400
                
            new_salesman = Salesman(
                name=data['name'],
                phone=phone,
                email=data['email'],
                gender=data.get('gender'),
                account_number=data.get('account_number'),
                salesman_id_code=unique_id,
                shop_id=shop_id,
                user_id=new_user.id
            )
            db.session.add(new_salesman)
            print(f"DEBUG: Salesman profile {unique_id} created for user {new_user.id}")
            
        db.session.commit()
        return jsonify({"message": "User created successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print(f"ERROR in register: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({"message": "Email and password are required"}), 400
            
        user = User.query.filter_by(email=data['email']).first()
        
        if user and check_password_hash(user.password_hash, data['password']):
            shop_id = None
            if user.role == 'shop_owner' and user.shop:
                shop_id = user.shop.id
            elif user.role == 'salesman' and user.salesman_profile:
                shop_id = user.salesman_profile.shop_id
                
            access_token = create_access_token(identity={'id': user.id, 'role': user.role, 'shop_id': shop_id})
            return jsonify(access_token=access_token, role=user.role, shop_id=shop_id), 200
            
        return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        print(f"ERROR in login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server error during login: {str(e)}"}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    current_user = get_jwt_identity()
    user = User.query.get(current_user['id'])
    
    shop_id = None
    shop_name = None
    if user.role == 'shop_owner' and user.shop:
        shop_id = user.shop.id
        shop_name = user.shop.name
    elif user.role == 'salesman' and user.salesman_profile:
        shop_id = user.salesman_profile.shop_id
        shop_name = user.salesman_profile.shop.name if user.salesman_profile.shop else None

    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "shop_id": shop_id,
        "shop_name": shop_name
    }), 200
