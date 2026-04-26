from .db import db
from datetime import datetime

class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(50), nullable=False) # SKU might not be unique globally, but per shop? Usually SKU is unique.
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False) # Perishable, Pharmaceuticals, etc.
    
    expiry_date = db.Column(db.Date, nullable=True)
    cost_price = db.Column(db.Float, nullable=False)
    selling_price = db.Column(db.Float, nullable=False)
    
    stock_quantity = db.Column(db.Integer, default=0)
    min_level = db.Column(db.Integer, default=10)
    max_level = db.Column(db.Integer, default=100)
    reorder_level = db.Column(db.Integer, default=20)
    restock_quantity = db.Column(db.Integer, default=50) # Qty to order when low/expired
    safety_stock = db.Column(db.Integer, default=5)
    lead_time = db.Column(db.Integer, default=1) # In days
    shelf_life_days = db.Column(db.Integer, nullable=True)
    
    batch_number = db.Column(db.String(50))
    qr_code = db.Column(db.String(100), unique=True, nullable=True) # Unique Scan Code
    
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_archived = db.Column(db.Boolean, default=False)

class ProductUnitOption(db.Model):
    """Stores multiple unit variations for a product (e.g., 0.5L, 1L, 3L)"""
    __tablename__ = 'product_unit_options'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    unit_type = db.Column(db.String(20), nullable=False) # kg, grams, litres, ml, units, packets
    unit_value = db.Column(db.Float, nullable=False) # 0.5, 1, 3
    selling_price = db.Column(db.Float, nullable=False)
    cost_price = db.Column(db.Float, nullable=True)
    stock_quantity = db.Column(db.Integer, default=0)
    reorder_level = db.Column(db.Integer, default=10)
    restock_quantity = db.Column(db.Integer, default=50)
    
    product = db.relationship('Product', backref=db.backref('unit_options', cascade="all, delete-orphan"))

class Transaction(db.Model):
    """Tracks stock movements (Sales, Restock, Return)"""
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False) # 'SALE', 'RESTOCK', 'ADJUSTMENT'
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=True) # Price at the time of transaction
    date = db.Column(db.DateTime, default=datetime.utcnow)
    salesman_id = db.Column(db.Integer, db.ForeignKey('salesmen.id'), nullable=True)
    incentive_amount = db.Column(db.Float, default=0.0) # Earned incentive for this sale
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    is_birthday_sale = db.Column(db.Boolean, default=False) # Flag for birthday discount
    discount_amount = db.Column(db.Float, default=0.0) # Total discount applied
    unit_type = db.Column(db.String(20)) # kg, grams, etc.
    unit_value = db.Column(db.Float) # 0.5, 1, 3

class SupplyRequest(db.Model):
    """Requests sent to suppliers for restock"""
    __tablename__ = 'supply_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    
    quantity_needed = db.Column(db.Integer, nullable=False)
    unit_type = db.Column(db.String(20)) # Added for variation support
    unit_value = db.Column(db.Float) # Added for variation support
    status = db.Column(db.String(20), default='Pending') # Pending, Approved, Shipped, Delivered, Cancelled
    reason = db.Column(db.String(50), nullable=False) # 'Low Stock', 'Expired'
    notes = db.Column(db.Text, nullable=True) # Added for variation details
    
    request_date = db.Column(db.DateTime, default=datetime.utcnow)
    delivery_date = db.Column(db.DateTime, nullable=True)
    expiry_date = db.Column(db.Date, nullable=True) # Expiry date provided by supplier for this restock batch
    
    # Relationships
    product = db.relationship('Product', backref='supply_requests')
    shop = db.relationship('Shop', backref='supply_requests')
    supplier = db.relationship('Supplier', backref='supply_requests')

class ProductBatch(db.Model):
    """Tracks individual batches of a product with their own expiry dates (FIFO)"""
    __tablename__ = 'product_batches'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    unit_option_id = db.Column(db.Integer, db.ForeignKey('product_unit_options.id'), nullable=True)
    quantity = db.Column(db.Integer, default=0)
    expiry_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    product = db.relationship('Product', backref=db.backref('batches', cascade="all, delete-orphan", lazy='dynamic'))
    unit_option = db.relationship('ProductUnitOption', backref=db.backref('batches', cascade="all, delete-orphan", lazy='dynamic'))
