# Smart Inventory Management System (SaaS Enterprise Level)

A full-stack Inventory Management System built with Python Flask and React.js.

## Tech Stack
- **Backend:** Python Flask, SQLAlchemy, JWT, Scikit-learn
- **Frontend:** React.js, Tailwind CSS, Vite
- **Database:** SQLite (Development) / PostgreSQL (Production ready)

## Project Structure
- `Backend/`: API and Logic
- `Frontend/`: React UI

## Setup Instructions

### 1. Backend Setup
Prerequisites: Python 3.8+

```bash
cd Backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

**Configuration:**
Create a `.env` file in `Backend/` (optional, defaults provided in `config.py`):
```
SECRET_KEY=your_secret
JWT_SECRET_KEY=your_jwt_secret
```

**Run Server:**
```bash
python app.py
```
Server runs on `http://localhost:5000`.

### 2. Frontend Setup
Prerequisites: Node.js 16+

```bash
cd Frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

## Features
- **Role Based Auth:** Admin, Shop Owner, Supplier.
- **Inventory Management:** CRUD, Low Stock Alerts.
- **ML Analytics:** Demand Prediction (Linear Regression).
- **Notifications:** Email/SMS (Mocked/Integrated).
- **Dashboards:** Dedicated views for each role.

## Default Roles
- Register a user via the `/register` page.
- Choose Role: `Shop Owner`, `Supplier`, or `Admin`.

## API Documentation
- `POST /api/auth/register`: Create account.
- `POST /api/auth/login`: Login & get JWT.
- `GET /api/inventory/`: Get products (Auth required).
