from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ml.association import get_market_basket_rules
from ml.prediction import predict_demand
from models import Transaction, Shop, Salesman
from services.weather_service import get_weather

analytics_bp = Blueprint('analytics', __name__)

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

@analytics_bp.route('/weather', methods=['GET'])
def weather():
    city = request.args.get('city', 'New York')
    data = get_weather(city)
    return jsonify(data), 200

@analytics_bp.route('/demand', methods=['GET'])
@jwt_required()
def demand_forecast():
    try:
        current_user = get_jwt_identity()
        shop_id = get_shop_id_for_user(current_user)
        if not shop_id: return jsonify({"message": "Shop not found"}), 404
        
        # Fetch recent sales transactions for this shop only
        transactions = Transaction.query.filter_by(shop_id=shop_id, transaction_type='SALE').all()
        sales_data = [{"date": t.date, "quantity": t.quantity} for t in transactions]
        
        prediction = predict_demand(sales_data)
        
        return jsonify({
            "message": "Demand Forecast",
            "predicted_next_day_sales": prediction,
            "note": "Based on linear regression of historical sales"
        }), 200
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"message": str(e)}), 500

@analytics_bp.route('/market-basket', methods=['GET'])
@jwt_required()
def market_basket():
    current_user = get_jwt_identity()
    shop_id = get_shop_id_for_user(current_user)
    if not shop_id: return jsonify({"message": "Shop not found"}), 404

    try:
        # In a real app, we'd filter market basket by shop too.
        # But for now the association logic is global. 
        # Let's just return the global rules or we could filter transactions first.
        rules = get_market_basket_rules(min_support=0.01) 
        return jsonify(rules), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500
