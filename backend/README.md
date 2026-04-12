# Backend

## Tech Stack

* **FastAPI**: High-performance Python web framework for the API layer.
* **PostgreSQL**: Relational database hosted on **AWS RDS**.
* **SQLAlchemy**: Object-Relational Mapping (ORM) for database interactions.
* **Pydantic**: Data validation and serialization (includes email format validation).


## Project Structure

backend/
├── main.py          # Application entry point, API routes, and static file serving
├── models.py        # SQLAlchemy database models (User, Session, Response)
├── schemas.py       # Pydantic models for request/response validation
├── database.py      # Database connection logic and session configuration
└── .env             # Environment variables for sensitive AWS credentials


## Install Dependencies

pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv pydantic[email]


## Running the Server

Run: 
uvicorn main:app --reload

Then open: 
http://127.0.0.1:8000/docs


## Database Schema Logic
- Users: Primary accounts containing name, email, and password.
- Sessions: Individual interview attempts, each belonging to a specific User.
- Responses: Detailed logs for each interview segment, containing:


## Constraints

Due to Foreign Key constraints, a Response cannot be created without an existing Session, and a Session cannot be created without a valid User

### Auth + sessions
- Added cookie-based auth with signup/login/logout + session lookup.
- Passwords are hashed with bcrypt (auto-upgrades plaintext or legacy hashes on login).
- Added `auth_sessions` table to track session id, expiry, and revocation.

### New endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`