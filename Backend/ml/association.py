import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from models import Sale, SaleItem, Product

def get_market_basket_rules(min_support=0.01, min_threshold=1.0):
    """
    Analyzes sales data to find association rules (Frequently Bought Together).
    Returns a list of rules: [{antecedents: [A], consequents: [B], lift: 2.5}]
    """
    # 1. Fetch Data
    sales = Sale.query.all()
    if not sales:
        return []

    # 2. Prepare Dataset: List of transactions (lists of product names)
    dataset = []
    for sale in sales:
        items = [item.product_id for item in sale.items]
        if items:
            dataset.append(items)
            
    if not dataset:
        return []

    # Map Product IDs to Names for better readability
    products = {p.id: p.name for p in Product.query.all()}
    dataset_names = [[products.get(pid, f"ID:{pid}") for pid in transaction] for transaction in dataset]

    # 3. One-Hot Encoding
    te = TransactionEncoder()
    te_ary = te.fit(dataset_names).transform(dataset_names)
    df = pd.DataFrame(te_ary, columns=te.columns_)

    # 4. Apriori Algorithm
    # min_support: Item must appear in at least X% of transactions
    frequent_itemsets = apriori(df, min_support=min_support, use_colnames=True)
    
    if frequent_itemsets.empty:
        return []

    # 5. Association Rules
    rules = association_rules(frequent_itemsets, metric="lift", min_threshold=min_threshold)
    
    # Format Results
    results = []
    for _, row in rules.iterrows():
        results.append({
            "bought": list(row['antecedents']),
            "recommend": list(row['consequents']),
            "confidence": round(row['confidence'], 2),
            "lift": round(row['lift'], 2)
        })
        
    return results
