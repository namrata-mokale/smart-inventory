import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Supplier, SupplierCatalog, Shop, SupplyRequest

app = create_app()
with app.app_context():
    with open('supplier_data.txt', 'w') as f:
        # Let's find the supplier from the screenshot or a representative one
        suppliers = Supplier.query.all()
        for s in suppliers:
            f.write(f"Supplier: {s.company_name} (ID: {s.id})\n")
            f.write("Linked Shops:\n")
            for shop in s.shops:
                f.write(f"  - {shop.name} (ID: {shop.id})\n")
            
            f.write("Catalog:\n")
            items = SupplierCatalog.query.filter_by(supplier_id=s.id).all()
            for it in items:
                f.write(f"  - SKU: {it.sku}, Name: {it.name}, Price: {it.base_price}\n")
            
            f.write("Supply Requests for this supplier's linked shops:\n")
            linked_shop_ids = [shop.id for shop in s.shops]
            reqs = SupplyRequest.query.filter(SupplyRequest.shop_id.in_(linked_shop_ids)).all()
            for r in reqs:
                f.write(f"  - Request ID: {r.id}, Shop: {r.shop.name}, Product: {r.product.name}, SKU: {r.product.sku}\n")
            
            f.write("-" * 20 + "\n")
        
        f.write("\nAll Supply Requests in DB:\n")
        all_reqs = SupplyRequest.query.all()
        for r in all_reqs:
            f.write(f"  - Request ID: {r.id}, Shop: {r.shop.name} (ID: {r.shop_id}), Product: {r.product.name}, SKU: {r.product.sku}\n")
