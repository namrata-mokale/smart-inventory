from .db import db
from datetime import datetime, date

class ExpiredProduct(db.Model):
    __tablename__ = 'expired_products'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, nullable=False)
    shop_id = db.Column(db.Integer, db.ForeignKey('shops.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    sku = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(50), nullable=True)
    expiry_date = db.Column(db.Date, nullable=True)
    shelf_life_days = db.Column(db.Integer, nullable=True)
    stock_at_expiry = db.Column(db.Integer, nullable=True)
    archived_at = db.Column(db.DateTime, default=datetime.utcnow)
