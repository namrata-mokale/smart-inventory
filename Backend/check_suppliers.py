print("Starting script...")
try:
    from app import create_app
    from models import Supplier, db
    print("Imports successful")
    app = create_app()
    print("App created")
    with app.app_context():
        print("In app context")
        suppliers = Supplier.query.all()
        print(f"Total Suppliers: {len(suppliers)}")
        for s in suppliers:
            print(f"ID: {s.id}, Name: {s.company_name}, User ID: {s.user_id}")
except Exception as e:
    print(f"Error: {e}")
