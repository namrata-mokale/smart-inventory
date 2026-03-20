import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Supplier, SupplierCatalog, Shop, SupplyRequest, User

app = create_app()
with app.app_context():
    with open('all_suppliers_data.txt', 'w') as f:
        suppliers = Supplier.query.all()
        for s in suppliers:
            f.write(f"Supplier: {s.company_name} (ID: {s.id}, User ID: {s.user_id})\n")
            f.write("Linked Shops:\n")
            for shop in s.shops:
                f.write(f"  - {shop.name} (ID: {shop.id})\n")
            
            f.write("Catalog:\n")
            items = SupplierCatalog.query.filter_by(supplier_id=s.id).all()
            for it in items:
                f.write(f"  - SKU: {it.sku}, Name: {it.name}, Price: {it.base_price}\n")
            f.write("-" * 20 + "\n")
        
        f.write("\nAll Shops:\n")
        shops = Shop.query.all()
        for shop in shops:
            f.write(f"  - {shop.name} (ID: {shop.id})\n")

        f.write("\nAll Supply Requests:\n")
        all_reqs = SupplyRequest.query.all()
        for r in all_reqs:
            f.write(f"  - ID: {r.id}, Shop: {r.shop.name} (ID: {r.shop_id}), Product: {r.product.name} (ID: {r.product_id}), SKU: {r.product.sku}, Status: {r.status}\n")
