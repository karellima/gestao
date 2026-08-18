

from app.models.role import Role, RoleModule
from app.models.user import User
from app.utils.security import criar_token_do_usuario, get_password_hash


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

        token = criar_token_do_usuario(user)
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


class TestSenhaMaiorQueOLimiteDoBcrypt:
    """O bcrypt recusa segredo acima de 72 bytes levantando ValueError.

    Enquanto o login deixava essa exceção subir, senha longa virava `500` — e,
    pior, virava oráculo de enumeração: o `verify_password` só roda quando o
    e-mail existe, então bastava mandar 200 bytes e ler o código de status para
    saber se a conta estava cadastrada. `401` significava "não existe" e `500`
    significava "existe". Enumerar assim não custa nada e não depende de medir
    tempo. Os testes abaixo prendem as duas pontas: nada de `500`, e resposta
    idêntica para conta existente e inexistente.
    """

    SENHA_LONGA = "A" * 200

    def test_login_com_senha_longa_nao_derruba_o_endpoint(self, client):
        response = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": self.SENHA_LONGA,
        })
        assert response.status_code == 401

    def test_login_com_senha_longa_nao_revela_se_a_conta_existe(self, client):
        existente = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": self.SENHA_LONGA,
        })
        inexistente = client.post("/api/auth/login", json={
            "email": "nao-existe@teste.com",
            "password": self.SENHA_LONGA,
        })
        assert existente.status_code == inexistente.status_code
        assert existente.json() == inexistente.json()

    def test_senha_longa_pode_ser_cadastrada_e_usada_no_login(self, client, db):
        user = User(
            name="Senha Longa",
            email="longa@teste.com",
            hashed_password=get_password_hash(self.SENHA_LONGA),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()

        response = client.post("/api/auth/login", json={
            "email": "longa@teste.com",
            "password": self.SENHA_LONGA,
        })
        assert response.status_code == 200


class TestCredenciaisEndurecidas:
    """Regras de credencial que o login e o cadastro passam a exigir.

    Duas coisas são deliberadamente assimétricas e os testes prendem as duas:
    senha **nova** tem tamanho mínimo, senha **já cadastrada** não — aplicar a
    regra no login trancaria para fora quem entrou antes dela. E o e-mail é
    comparado sem depender de caixa, porque a base tem registro anterior à
    normalização.
    """

    def test_email_com_caixa_e_espaco_entra_na_mesma_conta(self, client):
        response = client.post("/api/auth/login", json={
            "email": "  ADMIN@Admin.COM  ",
            "password": "admin",
        })
        assert response.status_code == 200

    def test_dominio_reservado_e_recusado(self, client):
        """`EmailStr` recusa `.test`, `.local` e afins — domínios de uso reservado.

        Não é detalhe de formato: é a razão de os usuários do E2E terem saído de
        `@e2e.test`. Quem for cadastrar conta de serviço, robô ou integração
        precisa de domínio real; endereço interno de rede local não passa mais.
        O teste existe para essa descoberta acontecer aqui, e não num CI vermelho
        com onze cenários de E2E caídos ao mesmo tempo.
        """
        for reservado in ("robo@interno.local", "conta@ambiente.test"):
            response = client.post("/api/auth/login", json={
                "email": reservado,
                "password": "qualquer-senha",
            })
            assert response.status_code == 422, reservado

    def test_email_malformado_e_recusado_antes_de_consultar_o_banco(self, client):
        response = client.post("/api/auth/login", json={
            "email": "isto-nao-e-email",
            "password": "qualquer",
        })
        assert response.status_code == 422

    def test_senha_antiga_curta_continua_entrando(self, client):
        """A senha do admin de teste tem 5 caracteres. Ela não pode ser barrada."""
        response = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": "admin",
        })
        assert response.status_code == 200

    def test_conta_inexistente_e_senha_errada_dao_a_mesma_resposta(self, client):
        errada = client.post("/api/auth/login", json={
            "email": "admin@admin.com",
            "password": "senha-errada-mas-longa",
        })
        inexistente = client.post("/api/auth/login", json={
            "email": "ninguem@teste.com",
            "password": "senha-errada-mas-longa",
        })
        assert errada.status_code == inexistente.status_code == 401
        assert errada.json() == inexistente.json()

    def test_conta_inexistente_paga_o_custo_do_bcrypt(self):
        """O tempo não pode separar conta existente de inexistente.

        A asserção é sobre ordem de grandeza, não sobre milissegundo: o que
        importa é o `verify_password` ter rodado. Sem o hash descartável este
        caminho voltaria em microssegundos.
        """
        import time

        from app.utils.security import verificar_senha_descartavel

        inicio = time.perf_counter()
        verificar_senha_descartavel("qualquer-senha")
        assert time.perf_counter() - inicio > 0.01

    def test_cadastro_recusa_senha_curta(self, client, auth_headers):
        response = client.post("/api/auth/register", json={
            "name": "Novo", "email": "novo@teste.com",
            "password": "curta", "role": "admin",
        }, headers=auth_headers)
        assert response.status_code == 422

    def test_cadastro_aceita_senha_de_doze_caracteres(self, client, auth_headers):
        response = client.post("/api/auth/register", json={
            "name": "Novo", "email": "novo@teste.com",
            "password": "senha-com-12", "role": "admin",
        }, headers=auth_headers)
        assert response.status_code == 200

    def test_cadastro_grava_o_email_normalizado(self, client, auth_headers):
        response = client.post("/api/auth/register", json={
            "name": "Caixa Alta", "email": "MAIUSCULO@Teste.com",
            "password": "senha-com-12", "role": "admin",
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["email"] == "maiusculo@teste.com"

    def test_cadastro_recusa_duplicado_que_so_difere_na_caixa(self, client, auth_headers):
        response = client.post("/api/auth/register", json={
            "name": "Clone", "email": "ADMIN@ADMIN.COM",
            "password": "senha-com-12", "role": "admin",
        }, headers=auth_headers)
        assert response.status_code == 400
class TestRevogacaoDeSessao:
    """`token_version` transforma "trocar a senha" em "derrubar as sessões".

    Antes disto, quem estivesse com o token continuava dentro por até 8 horas
    depois da troca de senha — inclusive quem tinha roubado o token, que era
    exatamente o motivo de trocar a senha.
    """

    #: `admin@test.com` é a fixture `admin_user` — é dela que sai o `auth_headers`
    #: e é o id dela que os testes usam no PUT. O `admin@admin.com` das outras
    #: classes vem do seed e é outro usuário: trocar a senha de um e tentar
    #: entrar com o outro foi o que fez estes testes falharem na primeira volta.
    def _login(self, client, email="admin@test.com", senha="admin"):
        return client.post("/api/auth/login", json={"email": email, "password": senha}).json()["access_token"]

    def test_token_para_de_valer_depois_da_troca_de_senha(self, client, auth_headers, admin_user):
        token = self._login(client)
        antes = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert antes.status_code == 200

        client.put(f"/api/auth/users/{admin_user.id}",
                   json={"password": "senha-nova-longa"}, headers=auth_headers)

        depois = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert depois.status_code == 401

    def test_token_emitido_depois_da_troca_continua_valendo(self, client, auth_headers, admin_user):
        client.put(f"/api/auth/users/{admin_user.id}",
                   json={"password": "senha-nova-longa"}, headers=auth_headers)

        novo = self._login(client, senha="senha-nova-longa")
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {novo}"})
        assert response.status_code == 200

    def test_trocar_senha_de_um_nao_derruba_o_outro(self, client, auth_headers, db):
        outro = User(name="Outro", email="outro@teste.com",
                     hashed_password=get_password_hash("senha-do-outro"),
                     role="admin", is_active=True)
        db.add(outro)
        db.commit()
        db.refresh(outro)

        token_do_outro = self._login(client, "outro@teste.com", "senha-do-outro")
        client.put(f"/api/auth/users/{outro.id}",
                   json={"password": "trocada-pelo-admin"}, headers=auth_headers)

        # O admin trocou a senha do outro: o outro cai, o admin segue.
        assert client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {token_do_outro}"}).status_code == 401
        assert client.get("/api/auth/me", headers=auth_headers).status_code == 200

    def test_desativar_derruba_e_reativar_nao_ressuscita(self, client, auth_headers, db):
        alvo = User(name="Alvo", email="alvo@teste.com",
                    hashed_password=get_password_hash("senha-do-alvo"),
                    role="admin", is_active=True)
        db.add(alvo)
        db.commit()
        db.refresh(alvo)

        token = self._login(client, "alvo@teste.com", "senha-do-alvo")
        client.put(f"/api/auth/users/{alvo.id}", json={"is_active": False}, headers=auth_headers)
        assert client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}).status_code in (401, 403)

        client.put(f"/api/auth/users/{alvo.id}", json={"is_active": True}, headers=auth_headers)
        assert client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}).status_code == 401

    def test_token_sem_versao_e_recusado(self, client, admin_user):
        """Token anterior a esta mudança não é aceito — logout único na subida."""
        from app.utils.security import create_access_token

        antigo = create_access_token({"sub": str(admin_user.id)})
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {antigo}"})
        assert response.status_code == 401

    def test_token_com_versao_de_outra_geracao_e_recusado(self, client, admin_user):
        from app.utils.security import create_access_token

        forjado = create_access_token({"sub": str(admin_user.id), "ver": 999})
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forjado}"})
        assert response.status_code == 401

    def test_usuario_novo_nasce_na_geracao_um(self, client, auth_headers):
        response = client.post("/api/auth/register", json={
            "name": "Novato", "email": "novato@teste.com",
            "password": "senha-com-12", "role": "admin",
        }, headers=auth_headers)
        assert response.status_code == 200
        token = self._login(client, "novato@teste.com", "senha-com-12")
        assert client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}).status_code == 200
