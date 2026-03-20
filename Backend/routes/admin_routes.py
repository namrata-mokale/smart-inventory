from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import User, Shop, Supplier, Product, db

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    total_users = User.query.count()
    total_shops = Shop.query.count()
    total_suppliers = Supplier.query.count()
    total_products = Product.query.count()
    
    # Low Stock Items
    low_stock = Product.query.filter(Product.stock_quantity <= Product.reorder_level).count()
    
    return jsonify({
        "total_users": total_users,
        "total_shops": total_shops,
        "total_suppliers": total_suppliers,
        "total_products": total_products,
        "low_stock_alerts": low_stock
    }), 200

# --- SHOP MANAGEMENT ---
@admin_bp.route('/shops', methods=['GET'])
@jwt_required()
def get_shops():
    shops = Shop.query.all()
    return jsonify([{
        "id": s.id,
        "name": s.name,
        "owner": s.owner.username,
        "email": s.owner.email
    } for s in shops]), 200

@admin_bp.route('/shops/<int:shop_id>', methods=['DELETE', 'OPTIONS', 'POST'])
@jwt_required()
def delete_shop(shop_id):
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200
        
    shop = Shop.query.get(shop_id)
    if not shop:
        return jsonify({"message": "Shop not found"}), 404
        
    db.session.delete(shop)
    db.session.commit()
    return jsonify({"message": "Shop deleted"}), 200

# --- SUPPLIER MANAGEMENT ---
@admin_bp.route('/suppliers', methods=['GET'])
@jwt_required()
def get_suppliers():
    suppliers = Supplier.query.all()
    return jsonify([{
        "id": s.id,
        "name": s.name,
        "contact": s.contact_person,
        "email": s.user.email if s.user else "N/A"
    } for s in suppliers]), 200

@admin_bp.route('/suppliers/<int:supplier_id>', methods=['DELETE', 'OPTIONS', 'POST'])
@jwt_required()
def delete_supplier(supplier_id):
    if request.method == 'OPTIONS':
        return jsonify({"message": "OK"}), 200

    supplier = Supplier.query.get(supplier_id)
    if not supplier:
        return jsonify({"message": "Supplier not found"}), 404
        
    db.session.delete(supplier)
    db.session.commit()
    return jsonify({"message": "Supplier deleted"}), 200
