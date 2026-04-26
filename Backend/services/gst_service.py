import re

# GST Rate mapping for India based on categories and item names
# 0% GST (Exempt)
EXEMPT_ITEMS = [
    r"milk", r"curd", r"lassi", r"paneer", r"vegetable", r"fruit", r"pulse", 
    r"wheat flour", r"atta", r"rice", r"salt", r"honey", r"roti", r"naan", 
    r"khakhra", r"chapati", r"papad", r"besan", r"stamp", r"postal", r"book", 
    r"newspaper", r"bangle", r"earthenware", r"sanitary napkin", r"perishable"
]

# 5% GST (Reduced)
REDUCED_ITEMS = [
    r"butter", r"ghee", r"cheese", r"namkeen", r"bhujia", r"jam", 
    r"jelly", r"pasta", r"cornflake", r"oil", r"shampoo", r"soap", r"toothpaste", 
    r"toothbrush", r"detergent", r"tableware", r"kitchenware", r"sewing machine",
    r"consumables", r"pharmaceuticals"
]

# 12% GST
MODERATE_ITEMS = [
    r"fruit juice", r"computer", r"umbrella", r"clock", r"watch"
]

# 28% GST (Luxury/High-Value)
LUXURY_ITEMS = [
    r"automobile", r"air conditioner", r"luxury", r"high-value"
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

    # Check for Luxury/High-Value Items (28%)
    for pattern in LUXURY_ITEMS:
        if re.search(pattern, name) or re.search(pattern, cat):
            return 0.28

    # Check for Exempt Items (0%)
    # Note: fresh paneer is 0%, branded is 5%.
    if "branded" in name or "packaged" in name or "processed" in name:
        pass # Skip exempt and move to reduced
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
            
    # Check for Moderate Items (12%)
    for pattern in MODERATE_ITEMS:
        if re.search(pattern, name) or re.search(pattern, cat):
            return 0.12

    # Default Standard Rate (18%)
    return 0.18
