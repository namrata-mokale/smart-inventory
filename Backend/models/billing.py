from .db import db
from datetime import datetime

class SupplierBill(db.Model):
    __tablename__ = 'supplier_bills'
    id = db.Column(db.Integer, primary_key=True)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    supply_request_id = db.Column(db.Integer, db.ForeignKey('supply_requests.id'), nullable=True)
    quantity = db.Column(db.Integer, nullable=False)
    unit_type = db.Column(db.String(20)) # Added for variation support
    unit_value = db.Column(db.Float) # Added for variation support
    unit_price = db.Column(db.Float, nullable=False)
    discount_percent = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, nullable=False) # Subtotal
    gst_amount = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='Pending') # Pending, Awaiting Payment, Paid, Failed
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    date_delivered = db.Column(db.DateTime, nullable=True)

    # Relationships
    shop = db.relationship('Shop', backref='bills')
    supplier = db.relationship('Supplier', backref='bills')
    product = db.relationship('Product', backref='bills')
    supply_request = db.relationship('SupplyRequest', backref='bill', uselist=False)

class SupplierQuote(db.Model):
    __tablename__ = 'supplier_quotes'
    id = db.Column(db.Integer, primary_key=True)
    supply_request_id = db.Column(db.Integer, db.ForeignKey('supply_requests.id'), nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    discount_percent = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, nullable=False) # Subtotal
    gst_amount = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='Offered') # Offered, Accepted, Rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    supply_request = db.relationship('SupplyRequest', backref='quotes')
    shop = db.relationship('Shop', backref='quotes')
    product = db.relationship('Product', backref='quotes')
    supplier = db.relationship('Supplier', backref='quotes')
