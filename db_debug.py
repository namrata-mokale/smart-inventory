import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Supplier, SupplierCatalog, Shop, SupplyRequest, User, Product

app = create_app()
with app.app_context():
    with open('db_debug.txt', 'w') as f:
        f.write("--- SUPPLIERS ---\n")
        suppliers = Supplier.query.all()
        for s in suppliers:
            f.write(f"Supplier ID: {s.id}, Name: {s.company_name}, User ID: {s.user_id}\n")
            f.write("Linked Shops:\n")
            for shop in s.shops:
                f.write(f"  - Shop ID: {shop.id}, Name: {shop.name}\n")
            f.write("Catalog Items:\n")
            catalog = SupplierCatalog.query.filter_by(supplier_id=s.id).all()
            for item in catalog:
                f.write(f"  - SKU: {item.sku}, Name: {item.name}, Price: {item.base_price}\n")
            f.write("-" * 20 + "\n")

        f.write("\n--- ALL SHOPS ---\n")
        shops = Shop.query.all()
        for shop in shops:
            f.write(f"Shop ID: {shop.id}, Name: {shop.name}, Owner ID: {shop.owner_id}\n")

        f.write("\n--- SUPPLY REQUESTS ---\n")
        requests = SupplyRequest.query.all()
        for r in requests:
            f.write(f"Request ID: {r.id}, Shop: {r.shop.name} (ID: {r.shop_id}), Product: {r.product.name} (ID: {r.product_id}), Status: {r.status}\n")
