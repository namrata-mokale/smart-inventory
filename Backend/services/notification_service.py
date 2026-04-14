import smtplib
import threading
from email.mime.text import MIMEText
from flask import current_app
import re
import random
import string
from datetime import date, timedelta
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
    from models import BirthdayOffer, db, Shop, Sale
    
    if not customer.dob:
        print(f"DEBUG: No DOB for customer {customer.email}")
        return False
        
    today = date.today()
    
    # Robust DOB parsing to check if today is birthday
    is_birthday = False
    is_in_window = False
    try:
        # Month name to number mapping
        month_map = {
            'january': 1, 'jan': 1,
            'february': 2, 'feb': 2,
            'march': 3, 'mar': 3,
            'april': 4, 'apr': 4,
            'may': 5,
            'june': 6, 'jun': 6,
            'july': 7, 'jul': 7,
            'august': 8, 'aug': 8,
            'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10,
            'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        
        dob_str = str(customer.dob).strip().lower()
        dob_month = None
        dob_day = None
        
        patterns = [
            (r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', 2, 3),  # YYYY-MM-DD
            (r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', 1, 2),  # DD-MM-YYYY
            (r'(\d{1,2})[-/](\d{1,2})', 1, 2),             # MM-DD
            (r'(\d{1,2})\s+([a-z]+)\s+(\d{4})', 1, 2),   # DD Month YYYY
            (r'([a-z]+)\s+(\d{1,2}),?\s+(\d{4})', 2, 1),  # Month DD, YYYY
        ]
        
        for pattern, m_group, d_group in patterns:
            match = re.search(pattern, dob_str)
            if match:
                m_val = match.group(m_group)
                d_val = match.group(d_group)
                
                if m_val.isalpha():
                    m_val = m_val[:3].lower()
                    if m_val in month_map:
                        dob_month = month_map[m_val]
                    else:
                        continue
                else:
                    dob_month = int(m_val)
                
                dob_day = int(d_val)
                break
        
        if dob_month and dob_day:
            # Check if today is birthday
            if dob_month == today.month and dob_day == today.day:
                is_birthday = True
                is_in_window = True
                print(f"DEBUG: Birthday MATCH for {customer.email}! Today: {today.strftime('%m-%d')}")
            else:
                # Check 5-day window + 1-day buffer for timezones
                birthdate_this_year = date(today.year, dob_month, dob_day)
                days_diff = (today - birthdate_this_year).days
                # Active if birthday was in the last 5 days, OR if it's tomorrow (to account for timezone differences)
                if -1 <= days_diff <= 5:
                    is_in_window = True
                    print(f"DEBUG: Within birthday window for {customer.email}! (Days diff: {days_diff})")
    except Exception as e:
        print(f"DEBUG: DOB parsing error in send_birthday_wish: {e}")
        return False
    
    if not is_in_window:
        print(f"DEBUG: Not in birthday window for {customer.email}")
        return False
    
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

    if not shops:
        print(f"DEBUG: No shops found for customer {customer.id}")
        return False
    
    print(f"DEBUG: Creating birthday offers for {len(shops)} shops")
    offers_made = []
    for shop in shops:
        # Check if ANY offer (used or unused) exists for this shop for this birthday period
        existing_offer = BirthdayOffer.query.filter_by(
            customer_id=customer.id, 
            shop_id=shop.id
        ).filter(BirthdayOffer.valid_until >= today).first()
        
        if existing_offer:
            offers_made.append(f"{shop.name}: {existing_offer.discount_percent}% OFF (existing)")
            print(f"DEBUG: Offer already exists for {shop.name}")
            continue

        # Always give an offer on birthday (100% instead of 70%)
        discount = random.choice([10, 15, 20, 25])
        code = 'BDAY-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        offer = BirthdayOffer(
            customer_id=customer.id,
            shop_id=shop.id,
            discount_percent=discount,
            offer_code=code,
            offer_text=f"Happy Birthday! Enjoy {discount}% OFF on your next purchase at {shop.name}.",
            valid_until=today + timedelta(days=5)
        )
        db.session.add(offer)
        offers_made.append(f"{shop.name}: {discount}% OFF (Code: {code})")
        print(f"DEBUG: Created {discount}% offer for {shop.name}")
    
    # Update last_birthday_wish to prevent duplicate wishes
    customer.last_birthday_wish = today
    db.session.commit()
    print(f"DEBUG: Committed {len(offers_made)} offers for {customer.email}")
    
    # Send Birthday Email
    if customer.email and offers_made:
        subject = "🎉 Happy Birthday from Smart Inven!"
        body = f"Hi {customer.name},\n\nWe wish you a very Happy Birthday! 🎂\n\n"
        body += "To celebrate, we have some special offers for you from your favorite shops:\n\n"
        for o in offers_made:
            body += f"• {o}\n"
        body += "\nLogin to your dashboard to see full details.\n"
        body += "\nBest Regards,\nSmart Inven Team"
        
        try:
            send_email(customer.email, subject, body)
            print(f"DEBUG: Birthday email sent to {customer.email}")
        except Exception as e:
            print(f"DEBUG: Failed to send birthday email: {e}")
    
    return True

def send_sms(to_phone, body):
    # client = Client(current_app.config['TWILIO_ACCOUNT_SID'], current_app.config['TWILIO_AUTH_TOKEN'])
    # message = client.messages.create(
    #     body=body,
    #     from_=current_app.config['TWILIO_PHONE_NUMBER'],
    #     to=to_phone
    # )
    print(f"Mock SMS to {to_phone}: {body}")
    return True
