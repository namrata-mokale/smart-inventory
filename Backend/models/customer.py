from .db import db
from datetime import datetime

class Customer(db.Model):
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id_code = db.Column(db.String(50), unique=True, nullable=True) # Unique ID like CUST-XXXX
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    address = db.Column(db.String(200))
    dob = db.Column(db.String(20), nullable=True) # Date of Birth
    last_birthday_wish = db.Column(db.Date, nullable=True) # Last time a birthday wish was sent
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Link to User model if registered
    loyalty_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Birthday offers
    birthday_offers = db.relationship('BirthdayOffer', backref='customer', lazy=True)
    
    # Many-to-Many relationship with Shops
    shops = db.relationship('Shop', secondary='customer_shops', backref='customers_linked')
    purchases = db.relationship('Sale', backref='customer', lazy=True)
    monthly_rations = db.relationship('MonthlyRation', backref='customer', lazy=True)

class MonthlyRation(db.Model):
    __tablename__ = 'monthly_rations'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    status = db.Column(db.String(20), default='draft') # draft, submitted
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = db.relationship('MonthlyRationItem', backref='ration', lazy=True, cascade="all, delete-orphan")
    shop = db.relationship('Shop', backref='monthly_rations')

class MonthlyRationOrder(db.Model):
    __tablename__ = 'monthly_ration_orders'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(20), nullable=False) # 'cod', 'online'
    payment_status = db.Column(db.String(20), default='pending') # 'pending', 'paid'
    delivery_status = db.Column(db.String(20), default='pending') # 'pending', 'shipped', 'delivered'
    delivery_address = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    items = db.relationship('MonthlyRationOrderItem', backref='order', lazy=True, cascade="all, delete-orphan")
    shop = db.relationship('Shop', backref='ration_orders')
    customer_rel = db.relationship('Customer', backref='ration_orders')

class MonthlyRationOrderItem(db.Model):
    __tablename__ = 'monthly_ration_order_items'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('monthly_ration_orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    product_name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)
    price_at_order = db.Column(db.Float, nullable=False)
    unit_option_id = db.Column(db.Integer, nullable=True) # Variation support

class MonthlyRationItem(db.Model):
    __tablename__ = 'monthly_ration_items'
    id = db.Column(db.Integer, primary_key=True)
    ration_id = db.Column(db.Integer, db.ForeignKey('monthly_rations.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False) # kg, litres, grams, etc.
    unit_option_id = db.Column(db.Integer, nullable=True) # Variation support
    price = db.Column(db.Float, nullable=True) # Store selected variation price
    
    product = db.relationship('Product')

class BirthdayOffer(db.Model):
    __tablename__ = 'birthday_offers'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    discount_percent = db.Column(db.Integer, nullable=False)
    offer_code = db.Column(db.String(20), unique=True, nullable=False) # Unique code for shop verification
    offer_text = db.Column(db.String(200))
    valid_until = db.Column(db.Date, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    shop = db.relationship('Shop', backref='birthday_offers')

# Association table for Customer-Shop (Multiple shops per customer)
customer_shops = db.Table('customer_shops',
    db.Column('customer_id', db.Integer, db.ForeignKey('customers.id'), primary_key=True),
    db.Column('shop_id', db.Integer, db.ForeignKey('shops.id'), primary_key=True)
)

class Sale(db.Model):
    __tablename__ = 'sales'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    shop = db.relationship('Shop', backref='sales', lazy=True)
    items = db.relationship('SaleItem', backref='sale', lazy=True)

class SaleItem(db.Model):
    __tablename__ = 'sale_items'
    
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_sale = db.Column(db.Float, nullable=False)
    unit_type = db.Column(db.String(20)) # l, kg, etc.
    unit_value = db.Column(db.Float) # 0.5, 1, etc.
