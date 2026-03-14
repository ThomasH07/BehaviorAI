# This is to test if connection works with AWS RDS 

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv() # Load your .env file: all the sensitive data

print(f"DEBUG: Host is {os.getenv('DB_HOST')}") # If this prints "None", it didn't find your .env file.


# Build the connection string; URL format: postgresql://user:password@host:port/dbname
DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

print("--- Attempting to connect to AWS RDS ---")

try:
    # Create the engine
    engine = create_engine(DATABASE_URL)
    
    # Try to connect 
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print("✅ SUCCESS: Connected to AWS RDS!")
        print(f"Database Version: {result.fetchone()[0]}")
        
except Exception as e:
    print("❌ ERROR: Could not connect to the database.")
    print(f"Details: {e}")