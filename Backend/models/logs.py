from .db import db
from datetime import datetime

class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(200), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)

class NotificationLog(db.Model):
    __tablename__ = 'notification_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    recipient = db.Column(db.String(100))
    message_type = db.Column(db.String(50)) # EMAIL, SMS
    status = db.Column(db.String(50)) # SENT, FAILED
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
