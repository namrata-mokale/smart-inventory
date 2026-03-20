import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from app import create_app
from models import Supplier, SupplierCatalog, Shop, SupplyRequest, User, Product, db
from services.matching_service import find_catalog_match

app = create_app()
with app.app_context():
    # Let's assume the user is logged in as Supplier 1 (retailerz) with user_id=2
    current_user = {'id': 2, 'role': 'supplier'}
    supplier = Supplier.query.filter_by(user_id=current_user['id']).first()
    
    print(f"TESTING FOR SUPPLIER: {supplier.company_name} (ID: {supplier.id})")
    
    # Check linked shops
    linked_shop_ids = [shop.id for shop in supplier.shops]
    print(f"Linked Shop IDs: {linked_shop_ids}")
    for shop_id in linked_shop_ids:
        shop = Shop.query.get(shop_id)
        print(f"  - Shop: {shop.name} (ID: {shop.id})")
        
    # Check requests that should be returned by filter
    requests = SupplyRequest.query.filter(SupplyRequest.shop_id.in_(linked_shop_ids)).all()
    print(f"Requests returned by filter (count: {len(requests)}):")
    for req in requests:
        print(f"  - Request ID: {req.id}, Shop: {req.shop.name} (ID: {req.shop_id}), Product: {req.product.name} (ID: {req.product_id}, SKU: {req.product.sku})")
        
        # Check catalog match
        catalog_item = find_catalog_match(supplier.id, req.product.sku, req.product.name)
        if catalog_item:
            print(f"    - MATCH FOUND: {catalog_item.name} (SKU: {catalog_item.sku}) Price: {catalog_item.base_price}")
        else:
            print(f"    - NO MATCH FOUND")
            
    print("\nALL SUPPLY REQUESTS IN DB:")
    all_reqs = SupplyRequest.query.all()
    for r in all_reqs:
        print(f"  - Request ID: {r.id}, Shop: {r.shop.name} (ID: {r.shop_id}), Product: {r.product.name} (SKU: {r.product.sku})")
