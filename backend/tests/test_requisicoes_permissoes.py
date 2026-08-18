from app.models.requisicao import Requisicao, RequisicaoItem
from app.models.stock import StockMovement
from app.models.user import User
from app.utils.security import criar_token_do_usuario


def _headers(user):
    token = criar_token_do_usuario(user)
    return {"Authorization": f"Bearer {token}"}


def _new_user(db, role, name, email, deposits=()):
    user = User(
        name=name,
        email=email,
        hashed_password="x",
        role=role.name,
        is_active=True,
    )
    user.deposits.extend(deposits)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _new_requisition(db, requester, requesting, fulfilling, product, status="pendente"):
    requisicao = Requisicao(
        requester_id=requester.id,
        deposit_requesting_id=requesting.id,
        deposit_fulfilling_id=fulfilling.id,
        status=status,
        reason="Teste de permissão",
    )
    db.add(requisicao)
    db.flush()
    db.add(RequisicaoItem(
        requisicao_id=requisicao.id,
        product_id=product.id,
        quantity_requested=5,
        quantity_fulfilled=5,
    ))
    db.commit()
    db.refresh(requisicao)
    return requisicao


class TestRequisicaoPermissions:
    def test_admin_can_receive_any_requisition(
        self, client, db, auth_headers, operador_user, seed_products, seed_deposits,
    ):
        req = _new_requisition(
            db, operador_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )

        response = client.put(
            f"/api/requisicoes/{req.id}/receive",
            json={"items": [{"product_id": seed_products[0].id, "quantity_received": 5}]},
            headers=auth_headers,
        )

        assert response.status_code == 200

    def test_requester_can_receive(
        self, client, db, auth_headers, operador_user, operador_headers, seed_products, seed_deposits,
    ):
        req = _new_requisition(
            db, operador_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )

        response = client.put(
            f"/api/requisicoes/{req.id}/receive",
            json={"items": [{"product_id": seed_products[0].id, "quantity_received": 5}]},
            headers=operador_headers,
        )

        assert response.status_code == 200

    def test_requesting_deposit_user_can_receive(
        self, client, db, auth_headers, admin_user, operador_role, seed_products, seed_deposits,
    ):
        deposit_user = _new_user(
            db, operador_role, "Operador Filial", "filial@test.com", [seed_deposits[1]],
        )
        req = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )

        response = client.put(
            f"/api/requisicoes/{req.id}/receive",
            json={"items": [{"product_id": seed_products[0].id, "quantity_received": 5}]},
            headers=_headers(deposit_user),
        )

        assert response.status_code == 200

    def test_unrelated_user_cannot_receive(
        self, client, db, auth_headers, admin_user, operador_role, seed_products, seed_deposits,
    ):
        unrelated = _new_user(db, operador_role, "Terceiro", "terceiro@test.com")
        req = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )

        response = client.put(
            f"/api/requisicoes/{req.id}/receive",
            json={"items": [{"product_id": seed_products[0].id, "quantity_received": 5}]},
            headers=_headers(unrelated),
        )

        assert response.status_code == 403

    def test_receive_keeps_one_exit_for_reprocessed_requisition(
        self, client, db, auth_headers, admin_user, seed_products, seed_deposits,
    ):
        req = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )
        payload = {
            "items": [{"product_id": seed_products[0].id, "quantity_received": 5}],
        }

        first = client.put(
            f"/api/requisicoes/{req.id}/receive", json=payload, headers=auth_headers,
        )
        assert first.status_code == 200

        db.refresh(req)
        req.status = "atendido"
        db.commit()
        second = client.put(
            f"/api/requisicoes/{req.id}/receive", json=payload, headers=auth_headers,
        )
        assert second.status_code == 200

        saidas = db.query(StockMovement).filter(
            StockMovement.source == "requisicao",
            StockMovement.movement_type == "saida",
            StockMovement.product_id == seed_products[0].id,
        ).all()
        assert len(saidas) == 1
        assert saidas[0].reason == f"Requisição #{req.id}: Teste de permissão"

    def test_requester_can_edit(
        self, client, db, auth_headers, operador_user, operador_headers, seed_products, seed_deposits,
    ):
        req = _new_requisition(
            db, operador_user, seed_deposits[1], seed_deposits[0], seed_products[0],
        )

        response = client.put(
            f"/api/requisicoes/{req.id}",
            json={"reason": "Editada pelo requisitante"},
            headers=operador_headers,
        )

        assert response.status_code == 200

    def test_admin_can_edit(
        self, client, db, auth_headers, admin_user, operador_user, seed_products, seed_deposits,
    ):
        req = _new_requisition(
            db, operador_user, seed_deposits[1], seed_deposits[0], seed_products[0],
        )

        response = client.put(
            f"/api/requisicoes/{req.id}",
            json={"reason": "Editada pelo admin"},
            headers=auth_headers,
        )

        assert response.status_code == 200

    def test_third_party_cannot_edit(
        self, client, db, auth_headers, admin_user, operador_role, seed_products, seed_deposits,
    ):
        third_party = _new_user(db, operador_role, "Terceiro", "terceiro-edit@test.com")
        req = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0],
        )

        response = client.put(
            f"/api/requisicoes/{req.id}",
            json={"reason": "Não deve editar"},
            headers=_headers(third_party),
        )

        assert response.status_code == 403

    def test_visibility_uses_requesting_deposit_and_non_pending_fulfilling_deposit(
        self, client, db, auth_headers, admin_user, operador_user, seed_products, seed_deposits,
    ):
        own_deposit = _new_requisition(
            db, admin_user, seed_deposits[0], seed_deposits[1], seed_products[0], "pendente",
        )
        foreign_pending = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0], "pendente",
        )
        fulfilling_after_pending = _new_requisition(
            db, admin_user, seed_deposits[1], seed_deposits[0], seed_products[0], "atendido",
        )

        response = client.get("/api/requisicoes/", headers=_headers(operador_user))

        assert response.status_code == 200
        visible_ids = {item["id"] for item in response.json()}
        assert visible_ids == {own_deposit.id, fulfilling_after_pending.id}

        assert client.get(
            f"/api/requisicoes/{fulfilling_after_pending.id}",
            headers=_headers(operador_user),
        ).status_code == 200
        assert client.get(
            f"/api/requisicoes/{foreign_pending.id}",
            headers=_headers(operador_user),
        ).status_code == 404
