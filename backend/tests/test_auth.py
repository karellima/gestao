

from app.models.role import Role, RoleModule
from app.models.user import User
from app.utils.security import create_access_token


class TestLoginAndAuthenticatedRoute:
    def test_login_success(self, client):
        response = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": "admin",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self, client):
        response = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": "wrong",
        })
        assert response.status_code == 401

    def test_authenticated_me_endpoint(self, client):
        login_response = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": "admin",
        })
        token = login_response.json()["access_token"]

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@admin.com"
        assert data["role"] == "admin"
        assert data["name"] == "Administrador"
        assert data["is_active"] is True

    def test_me_endpoint_without_token_returns_401(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_me_endpoint_returns_own_permissions(self, client, db):
        role = Role(name="usuario-limitado", is_admin=False, is_default=False)
        db.add(role)
        db.flush()
        db.add(RoleModule(role_id=role.id, module="products", access_level="edit"))
        user = User(
            name="Usuário Limitado",
            email="limitado@teste.com",
            hashed_password="x",
            role=role.name,
            is_active=True,
        )
        db.add(user)
        db.commit()

        token = create_access_token({"sub": str(user.id)})
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["is_admin"] is False
        assert response.json()["permissions"] == {"products": "edit"}

        roles_response = client.get(
            "/api/roles/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert roles_response.status_code == 403

    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
