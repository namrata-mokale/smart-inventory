import re

# GST Rate mapping for India
# 0% GST (Exempt)
EXEMPT_ITEMS = [
    r"milk", r"curd", r"lassi", r"paneer", r"vegetable", r"fruit", r"pulse", 
    r"wheat flour", r"atta", r"rice", r"salt", r"honey", r"roti", r"naan", 
    r"khakhra", r"chapati", r"papad", r"besan", r"stamp", r"postal", r"book", 
    r"newspaper", r"bangle", r"earthenware", r"sanitary napkin"
]

# 5% GST (Reduced)
REDUCED_ITEMS = [
    r"butter", r"ghee", r"cheese", r"paneer", r"namkeen", r"bhujia", r"jam", 
    r"jelly", r"pasta", r"cornflake", r"oil", r"shampoo", r"soap", r"toothpaste", 
    r"toothbrush", r"detergent", r"tableware", r"kitchenware", r"sewing machine"
]

def get_gst_rate(product_name, category=None):
    """
    Determine the GST rate (as a decimal) based on product name and category.
    Default is 18% (0.18).
    """
    if not product_name:
        return 0.18
        
    name = product_name.lower().strip()
    cat = category.lower().strip() if category else ""

    # Check for Exempt Items (0%)
    # Note: User specified "Fresh milk", "curd (unpacked)", etc. 
    # For paneer, user said fresh paneer is 0%, branded is 5%.
    # We'll use a heuristic: if "branded" or "packaged" is in the name, it's 5%.
    if "branded" in name or "packaged" in name or "processed" in name:
        # Move to reduced check if it was branded paneer/curd
        pass
    else:
        for pattern in EXEMPT_ITEMS:
            if re.search(pattern, name) or re.search(pattern, cat):
                # Special case for Paneer: Fresh (unlabeled) is 0, branded is 5
                if "paneer" in name and ("branded" in name or "packaged" in name):
                    return 0.05
                return 0.0
                
    # Check for Reduced Items (5%)
    for pattern in REDUCED_ITEMS:
        if re.search(pattern, name) or re.search(pattern, cat):
            return 0.05
            
    # Default Standard Rate (18%)
    return 0.18
