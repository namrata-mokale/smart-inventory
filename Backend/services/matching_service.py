from models.db import db
import re

# Simple dictionary for common synonyms mentioned by the user and other related items
SYNONYMS = {
    "bread": ["toast", "bun", "loaf", "bakery"],
    "toast": ["bread", "bun", "loaf", "bakery"],
    "biscuit": ["biscuits", "cookies", "cookie", "snacks"],
    "biscuits": ["biscuit", "cookies", "cookie", "snacks"],
    "cookie": ["cookies", "biscuit", "biscuits", "snacks"],
    "cookies": ["cookie", "biscuit", "biscuits", "snacks"],
    "milk": ["dairy", "beverage", "cream"],
    "soda": ["coke", "soft drink", "beverage", "pop"],
    "chips": ["crisps", "snacks", "wafer"],
    "crisps": ["chips", "snacks", "wafer"],
    "water": ["mineral water", "beverage", "drink", "aqua"],
    "cola": ["soda", "coke", "soft drink", "beverage"],
    "oil": ["cooking oil", "vegetable oil", "fats"],
    "flour": ["atta", "maida", "powder", "grain"],
    "sugar": ["sweetener", "cane sugar", "powder"]
}

def normalize_name(name):
    """Normalize names for better matching: lowercase, strip, remove plurals (s, es, ies)."""
    if not name:
        return ""
    # Lowercase and remove special characters except spaces
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9\s]', '', name)
    
    # 1. ies -> y (berries -> berry)
    if name.endswith('ies') and len(name) > 5:
        return name[:-3] + 'y'
        
    # 2. es -> "" (tomatoes -> tomato, boxes -> box)
    # But check common endings that use 'es' as a plural
    if name.endswith('es') and len(name) > 4:
        if name.endswith('oes') or name.endswith('xes') or name.endswith('ches') or name.endswith('shes'):
            return name[:-2]
            
    # 3. s -> "" (biscuits -> biscuit, chips -> chip)
    if name.endswith('s') and len(name) > 3:
        # Check if it's likely a plural (not ending in 'ss' like 'glass')
        if not name.endswith('ss'):
            return name[:-1]
            
    return name

def names_match(name1, name2):
    """Check if two product names match using flexible fuzzy/synonym/keyword logic."""
    if not name1 or not name2:
        return False
        
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    
    # 1. Direct normalized match (e.g., "Biscuits" vs "biscuit")
    if n1 == n2:
        return True
        
    # 2. Check for shared significant words (excluding small words like 'of', 'and', 'the')
    # and common generic product terms
    generic_terms = {'product', 'item', 'pack', 'bottle', 'box', 'quantity', 'brand'}
    words1 = [w for w in n1.split() if len(w) > 2 and w not in generic_terms]
    words2 = [w for w in n2.split() if len(w) > 2 and w not in generic_terms]
    
    # If they share any significant word that is NOT a generic term, it's a likely match
    for w1 in words1:
        for w2 in words2:
            if w1 == w2:
                return True
            # Check synonyms list for each word pair
            for key, syns in SYNONYMS.items():
                key_norm = normalize_name(key)
                syns_norm = [normalize_name(s) for s in syns]
                if (w1 == key_norm and w2 in syns_norm) or (w2 == key_norm and w1 in syns_norm):
                    return True
                
    # 2. Check for substring match (flexible for plurals like "oil" vs "oils")
    if n1 in n2 or n2 in n1:
        return True
        
    # 3. Check for plural/singular matches by stripping common endings
    def normalize(s):
        s = s.rstrip('s').rstrip('es')
        return s
    
    if normalize(n1) == normalize(n2):
        return True

    return False

def find_catalog_match(supplier_id, product_sku, product_name):
    """
    Find a matching item in a supplier's catalog focusing on product name similarity.
    SKU is used only as a secondary fallback if the names are somewhat similar.
    """
    from models import SupplierCatalog
    
    # 1. Search by Name first (most important for user)
    all_catalog_items = SupplierCatalog.query.filter_by(supplier_id=supplier_id).all()
    for item in all_catalog_items:
        if names_match(item.name, product_name):
            return item
            
    # 2. SKU fallback - ONLY if name match failed AND the names aren't completely different
    # If the requested product name is "abc" and catalog name is "milk", SKU match shouldn't happen
    # unless they are explicitly mapped (not yet implemented).
    sku = product_sku.lower().strip() if product_sku else ""
    if sku:
        match = SupplierCatalog.query.filter(
            SupplierCatalog.supplier_id == supplier_id,
            db.func.lower(SupplierCatalog.sku) == sku
        ).first()
        if match:
            # Check if names are completely different
            if not names_match(match.name, product_name):
                # If names are very different, don't match by SKU alone
                # to avoid "abc" matching "milk" just because they share SKU "01"
                return None
            return match
            
    return None
