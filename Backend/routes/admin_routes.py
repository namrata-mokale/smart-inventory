from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import User, Shop, Supplier, Product, Customer, Salesman, db

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    total_users = User.query.count()
    total_shops = Shop.query.count()
    total_suppliers = Supplier.query.count()
    total_products = Product.query.count()
    total_customers = Customer.query.count()
    total_salesmen = Salesman.query.count()
    
    # Low Stock Items
    low_stock = Product.query.filter(Product.stock_quantity <= Product.reorder_level).count()
    
    return jsonify({
        "total_users": total_users,
        "total_shops": total_shops,
        "total_suppliers": total_suppliers,
        "total_products": total_products,
        "total_customers": total_customers,
        "total_salesmen": total_salesmen,
        "low_stock_alerts": low_stock
    }), 200

# --- USER MANAGEMENT ---
@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    users = User.query.all()
    return jsonify([{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "phone": u.phone,
        "created_at": u.created_at.strftime('%Y-%m-%d') if u.created_at else "N/A"
    } for u in users]), 200

# --- SHOP MANAGEMENT ---
@admin_bp.route('/shops', methods=['GET'])
@jwt_required()
def get_shops():
    shops = Shop.query.all()
    return jsonify([{
        "id": s.id,
        "name": s.name,
        "location": s.location,
        "owner": s.owner.name if s.owner else "N/A",
        "email": s.owner.email if s.owner else "N/A",
        "created_at": s.created_at.strftime('%Y-%m-%d') if s.created_at else "N/A",
        "salesmen_count": len(s.salesmen),
        "customers_count": len(s.customers_linked),
        "suppliers_count": len(s.suppliers)
    } for s in shops]), 200

# --- CUSTOMER MANAGEMENT ---
@admin_bp.route('/customers', methods=['GET'])
@jwt_required()
def get_customers():
    customers = Customer.query.all()
    return jsonify([{
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "linked_shops": [s.name for s in c.shops],
        "registered_account": c.user.email if c.user else "No"
    } for c in customers]), 200

@admin_bp.route('/customers/<int:cid>', methods=['DELETE'])
@jwt_required()
def delete_customer(cid):
    customer = Customer.query.get(cid)
    if not customer:
        return jsonify({"message": "Customer not found"}), 404
    
    # Delete any birthday offers linked to this customer first to avoid constraint errors
    from models import BirthdayOffer, MonthlyRation, MonthlyRationOrder, Sale, Transaction, MonthlyRationItem, MonthlyRationOrderItem
    BirthdayOffer.query.filter_by(customer_id=cid).delete()
    
    # Delete related ration items first to avoid foreign key constraints
    rations = MonthlyRation.query.filter_by(customer_id=cid).all()
    ration_ids = [r.id for r in rations]
    if ration_ids:
        MonthlyRationItem.query.filter(MonthlyRationItem.ration_id.in_(ration_ids)).delete(synchronize_session=False)
    MonthlyRation.query.filter_by(customer_id=cid).delete()
    
    orders = MonthlyRationOrder.query.filter_by(customer_id=cid).all()
    order_ids = [o.id for o in orders]
    if order_ids:
        MonthlyRationOrderItem.query.filter(MonthlyRationOrderItem.order_id.in_(order_ids)).delete(synchronize_session=False)
    MonthlyRationOrder.query.filter_by(customer_id=cid).delete()
    
    # Nullify customer_id in sales and transactions instead of deleting the financial records
    Sale.query.filter_by(customer_id=cid).update({Sale.customer_id: None})
    Transaction.query.filter_by(customer_id=cid).update({Transaction.customer_id: None})
    
    db.session.delete(customer)
    db.session.commit()
    return jsonify({"message": "Customer deleted permanently by admin"}), 200

# --- SALESMAN MANAGEMENT ---
@admin_bp.route('/salesmen', methods=['GET'])
@jwt_required()
def get_salesmen():
    salesmen = Salesman.query.all()
    return jsonify([{
        "id": s.id,
        "name": s.name,
        "phone": s.phone,
        "shop": s.shop.name if s.shop else "N/A",
        "email": s.email or (s.user.email if s.user else "N/A")
    } for s in salesmen]), 200

# --- SUPPLIER MANAGEMENT ---
@admin_bp.route('/suppliers', methods=['GET'])
@jwt_required()
def get_suppliers():
    suppliers = Supplier.query.all()
    return jsonify([{
        "id": s.id,
        "name": s.company_name,
        "contact": s.contact_person,
        "email": s.user.email if s.user else "N/A",
        "linked_shops": [sh.name for sh in s.shops]
    } for s in suppliers]), 200
