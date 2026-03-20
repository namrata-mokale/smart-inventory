import requests
from flask import current_app

def get_weather(city):
    api_key = current_app.config.get('OPENWEATHER_API_KEY')
    if not api_key:
        return {"temp": 25, "condition": "Sunny (Mock)"}
    
    try:
        url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
        res = requests.get(url)
        if res.status_code == 200:
            data = res.json()
            return {
                "temp": data['main']['temp'],
                "condition": data['weather'][0]['main']
            }
    except Exception as e:
        print(f"Weather API Error: {e}")
        pass
    return {"temp": 25, "condition": "Sunny (Fallback)"}
