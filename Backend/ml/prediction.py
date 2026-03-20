import numpy as np
from sklearn.linear_model import LinearRegression
import pandas as pd

def predict_demand(sales_data):
    """
    sales_data: List of dictionaries [{'date': '2023-01-01', 'quantity': 10}, ...]
    Returns predicted quantity for next period.
    """
    if not sales_data or len(sales_data) < 2:
        # Not enough data for regression, return last quantity or 0
        return sales_data[0]['quantity'] if sales_data else 0
        
    df = pd.DataFrame(sales_data)
    df['date'] = pd.to_datetime(df['date'])
    df['day_ordinal'] = df['date'].map(pd.Timestamp.toordinal)
    
    X = df[['day_ordinal']]
    y = df['quantity']
    
    model = LinearRegression()
    model.fit(X, y)
    
    # Predict next day
    next_day = df['day_ordinal'].max() + 1
    prediction = model.predict([[next_day]])
    
    return max(0, int(prediction[0]))
