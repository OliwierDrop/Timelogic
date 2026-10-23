from fastapi.testclient import TestClient


def login(client: TestClient, email: str):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "strong-password-123"})
    assert response.status_code == 200, response.text
    return {"X-CSRF-Token": response.json()["csrf_token"]}
