import sys
import os
from fastapi.testclient import TestClient

# sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200

def test_get_random_question():
    response = client.get("/api/questions/random")
    assert response.status_code == 200
