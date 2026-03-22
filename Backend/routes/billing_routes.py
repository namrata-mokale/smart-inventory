from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import SupplierBill, Shop, Product, Supplier, db, User, Salesman
from services.notification_service import send_email

billing_bp = Blueprint('billing', __name__)

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

@billing_bp.route('/shop', methods=['GET'])
@jwt_required()
def list_shop_bills():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id:
        return jsonify([]), 200
    bills = SupplierBill.query.filter_by(shop_id=shop_id).order_by(SupplierBill.date_created.desc()).all()
    res = []
    for b in bills:
        product = Product.query.get(b.product_id)
        supplier = Supplier.query.get(b.supplier_id)
        res.append({
            "id": b.id,
            "date": b.date_created.strftime('%Y-%m-%d'),
            "product": product.name if product else None,
            "sku": product.sku if product else None,
            "unit_type": b.unit_type,
            "unit_value": b.unit_value,
            "supplier": supplier.company_name if supplier else None,
            "quantity": b.quantity,
            "unit_price": b.unit_price,
            "discount_percent": b.discount_percent,
            "total": b.total,
            "gst_amount": b.gst_amount,
            "grand_total": b.grand_total,
            "status": b.status
        })
    return jsonify(res), 200

@billing_bp.route('/pay/<int:bill_id>', methods=['POST'])
@jwt_required()
def pay_bill(bill_id):
    try:
        current_user = get_jwt_identity()
        print(f"DEBUG: pay_bill called for bill {bill_id} by user {current_user['id']}")
        
        shop = Shop.query.filter_by(owner_id=current_user['id']).first()
        if not shop:
            # Fallback for salesman
            from models import Salesman
            salesman = Salesman.query.filter_by(user_id=current_user['id']).first()
            if salesman:
                shop = Shop.query.get(salesman.shop_id)
            
        if not shop:
            print("DEBUG: Shop not found for user")
            return jsonify({"message": "Shop not found"}), 404
            
        bill = SupplierBill.query.get_or_404(bill_id)
        if bill.shop_id != shop.id:
            print(f"DEBUG: Unauthorized - Bill shop {bill.shop_id} != User shop {shop.id}")
            return jsonify({"message": "Unauthorized"}), 403
            
        if bill.status != 'Awaiting Payment' and bill.status != 'Pending':
            print(f"DEBUG: Bill status is {bill.status}, cannot pay")
            return jsonify({"message": f"Bill is in {bill.status} status and cannot be paid."}), 400
            
        # Simulate payment processing
        bill.status = 'Paid'
        
        # Update corresponding supply request status to 'Paid' (Ready to Ship)
        from models import SupplyRequest
        req = SupplyRequest.query.get(bill.supply_request_id)
        supplier = None
        product = Product.query.get(bill.product_id)
        
        if req:
            req.status = 'Paid'
            req.expiry_date = bill.expiry_date # Set the request's final expiry date to match the bill
            supplier = Supplier.query.get(bill.supplier_id)
            
            # Notify supplier of payment
            if supplier and supplier.user and supplier.user.email:
                subject = f"Payment Received for Order #{req.id}"
                content = f"Payment of ₹{bill.total:.2f} has been received for {product.name if product else 'Order'}.\n\n" \
                          f"Please login to your dashboard and ship the order."
                try:
                    send_email(supplier.user.email, subject, content)
                except Exception as e: 
                    print(f"DEBUG: Supplier notification failed: {e}")
                
        # Notify shop owner of payment confirmation
        try:
            owner = User.query.get(shop.owner_id)
            if owner and owner.email:
                subject = f"Payment Confirmation - Order #{req.id if req else 'N/A'}"
                content = f"Your payment of ₹{bill.total:.2f} for {product.name if product else 'Order'} has been processed successfully.\n\n" \
                          f"Supplier: {supplier.company_name if supplier and hasattr(supplier, 'company_name') else 'N/A'}\n" \
                          f"The supplier has been notified and will ship your order shortly."
                send_email(owner.email, subject, content)
        except Exception as e:
            print(f"DEBUG: Shop owner notification failed: {e}")
                
        db.session.commit()
        print(f"DEBUG: Payment successful for bill {bill_id}")
        return jsonify({"message": "Payment successful", "status": "Paid"}), 200
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Server Error during payment: {str(e)}"}), 500

@billing_bp.route('/supplier', methods=['GET'])
@jwt_required()
def list_supplier_bills():
    current_user = get_jwt_identity()
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
    if not supplier:
        return jsonify([]), 200
    bills = SupplierBill.query.filter_by(supplier_id=supplier.id).order_by(SupplierBill.date_created.desc()).all()
    res = []
    for b in bills:
        product = Product.query.get(b.product_id)
        shop = Shop.query.get(b.shop_id)
        res.append({
            "id": b.id,
            "date": b.date_created.strftime('%Y-%m-%d'),
            "product": product.name if product else None,
            "sku": product.sku if product else None,
            "unit_type": b.unit_type,
            "unit_value": b.unit_value,
            "shop": shop.name if shop else None,
            "quantity": b.quantity,
            "unit_price": b.unit_price,
            "discount_percent": b.discount_percent,
            "total": b.total,
            "gst_amount": b.gst_amount,
            "grand_total": b.grand_total,
            "status": b.status
        })
    return jsonify(res), 200
