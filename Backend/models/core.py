from .db import db
from datetime import datetime

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(10))
    address = db.Column(db.String(200))
    pincode = db.Column(db.String(10))
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'admin', 'shop_owner', 'supplier', 'customer'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    shop = db.relationship('Shop', backref='owner', uselist=False)
    supplier_profile = db.relationship('Supplier', backref='user', uselist=False)
    customer_profile = db.relationship('Customer', backref='user', uselist=False)
    salesman_profile = db.relationship('Salesman', backref='user', uselist=False)

class Shop(db.Model):
    __tablename__ = 'shops'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    products = db.relationship('Product', backref='shop', lazy=True)
    salesmen = db.relationship('Salesman', backref='shop', lazy=True)

class Salesman(db.Model):
    __tablename__ = 'salesmen'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(10), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    gender = db.Column(db.String(20), nullable=True) # Male, Female, Other
    account_number = db.Column(db.String(50), nullable=True) # Bank details
    salesman_id_code = db.Column(db.String(50), unique=True, nullable=False) # The unique ID given by shop owner
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Link to User model
    incentive_rate = db.Column(db.Float, default=2.0) # Percentage of sales as incentive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    transactions = db.relationship('Transaction', backref='salesman', lazy=True)

class Supplier(db.Model):
    __tablename__ = 'suppliers'
    
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(100), nullable=False)
    contact_person = db.Column(db.String(100))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Many-to-Many relationship with Shops (Assigned shops)
    shops = db.relationship('Shop', secondary='supplier_shops', backref='suppliers')

# Association table for Supplier-Shop
supplier_shops = db.Table('supplier_shops',
    db.Column('supplier_id', db.Integer, db.ForeignKey('suppliers.id'), primary_key=True),
    db.Column('shop_id', db.Integer, db.ForeignKey('shops.id'), primary_key=True)
)
