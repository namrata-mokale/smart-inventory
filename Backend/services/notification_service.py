import smtplib
import threading
from email.mime.text import MIMEText
from flask import current_app
# from twilio.rest import Client

def send_email_async(app, to_email, subject, body):
    with app.app_context():
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = to_email

        try:
            if not app.config['MAIL_SERVER']:
                print(f"Mock Email to {to_email}: {subject}")
                return
                
            print(f"Attempting to send email to {to_email} via {app.config['MAIL_SERVER']}...")
            
            # Ensure TLS is used if configured (usually True for Gmail)
            server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'], timeout=10)
            
            server.ehlo() # Identify ourselves to smtp client
            if app.config.get('MAIL_USE_TLS'):
                server.starttls() # Secure the connection
                server.ehlo() # Re-identify as an encrypted connection
                
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            server.send_message(msg)
            server.quit()
            print(f"Email sent successfully to {to_email}")
        except Exception as e:
            print(f"Failed to send async email: {e}")

def send_email(to_email, subject, body):
    """Sends email in a background thread to prevent blocking the request."""
    from flask import current_app
    app = current_app._get_current_object()
    thread = threading.Thread(target=send_email_async, args=(app, to_email, subject, body))
    thread.start()
    return True # Return immediately to caller

def send_birthday_wish(customer):
    """Checks if today is customer's birthday and sends email + creates offers if so."""
    from datetime import date, timedelta
    import random
    from models import BirthdayOffer, db, Shop, Sale
    
    if not customer.dob:
        return False
        
    today = date.today()
    today_str = today.strftime('%m-%d')
    
    # Format of DOB is expected to be 'YYYY-MM-DD'
    try:
        if customer.dob[5:10] == today_str:
            # Check if we already sent a wish today
            if customer.last_birthday_wish == today:
                print(f"DEBUG: Birthday wish already sent today for {customer.email}")
                return False
                
            # Logic to find shops to offer from
            shops = customer.shops # Linked shops
            if not shops:
                # Fallback for customers added directly but not linked via customer_shops association
                purchase_shop_ids = db.session.query(Sale.shop_id).filter(Sale.customer_id == customer.id).distinct().all()
                if purchase_shop_ids:
                    shops = Shop.query.filter(Shop.id.in_([sid[0] for sid in purchase_shop_ids])).all()

            offers_made = []
            for shop in shops:
                # Check if an offer already exists for this customer and shop created today
                existing_offer = BirthdayOffer.query.filter_by(
                    customer_id=customer.id, 
                    shop_id=shop.id
                ).filter(db.func.date(BirthdayOffer.created_at) == today).first()
                
                if existing_offer:
                    offers_made.append(f"{shop.name}: {existing_offer.discount_percent}% OFF")
                    continue

                # 70% chance to give an offer from a shop
                if random.random() < 0.7:
                    import string
                    discount = random.choice([5, 10, 15, 20, 25])
                    code = 'BDAY-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                    offer = BirthdayOffer(
                        customer_id=customer.id,
                        shop_id=shop.id,
                        discount_percent=discount,
                        offer_code=code,
                        offer_text=f"Happy Birthday! Enjoy {discount}% OFF on your next purchase at {shop.name}.",
                        valid_until=today + timedelta(days=7) # Valid for 1 week
                    )
                    db.session.add(offer)
                    offers_made.append(f"{shop.name}: {discount}% OFF (Code: {code})")
            
            db.session.commit() # Commit offers immediately to prevent duplicates in near-simultaneous calls
            
            # Send Birthday Email
            if customer.email:
                subject = "🎉 Happy Birthday from Smart Inven!"
                body = f"Hi {customer.name},\n\nWe wish you a very Happy Birthday! 🎂\n\n"
                if offers_made:
                    body += "To celebrate, we have some special offers for you from your favorite shops:\n\n"
                    for o in offers_made:
                        body += f"• {o}\n"
                    body += "\nLogin to your dashboard to see full details.\n"
                else:
                    body += "We hope you have a fantastic day!\n"
                
                body += "\nBest Regards,\nSmart Inven Team"
                
                if send_email(customer.email, subject, body):
                    customer.last_birthday_wish = today
                    db.session.commit()
                    return True
    except Exception as e:
        print(f"ERROR: Failed to process birthday for {customer.email}: {e}")
        
    return False

def send_sms(to_phone, body):
    # client = Client(current_app.config['TWILIO_ACCOUNT_SID'], current_app.config['TWILIO_AUTH_TOKEN'])
    # message = client.messages.create(
    #     body=body,
    #     from_=current_app.config['TWILIO_PHONE_NUMBER'],
    #     to=to_phone
    # )
    print(f"Mock SMS to {to_phone}: {body}")
    return True
