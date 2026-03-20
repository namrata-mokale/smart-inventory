from .db import db
from datetime import datetime, date

class SupplierCatalog(db.Model):
    __tablename__ = 'supplier_catalog'
    id = db.Column(db.Integer, primary_key=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    sku = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=True)
    base_price = db.Column(db.Float, nullable=False) # Keep for compatibility, or as default
    expiry_date = db.Column(db.Date, nullable=True)
    shelf_life_days = db.Column(db.Integer, nullable=True)
    discount_percent = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SupplierCatalogVariation(db.Model):
    """Stores multiple unit variations for a supplier's catalog item"""
    __tablename__ = 'supplier_catalog_variations'
    id = db.Column(db.Integer, primary_key=True)
    catalog_item_id = db.Column(db.Integer, db.ForeignKey('supplier_catalog.id'), nullable=False)
    unit_type = db.Column(db.String(20), nullable=False) # kg, litres, etc.
    unit_value = db.Column(db.Float, nullable=False) # 1, 2, 3
    base_price = db.Column(db.Float, nullable=False) # Individual price for this variation
    
    catalog_item = db.relationship('SupplierCatalog', backref=db.backref('variations', cascade="all, delete-orphan"))
