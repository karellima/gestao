# Rotação de credenciais — incidente de 2026-08-10

Registro do que foi exposto em commits públicos deste repositório e do que ainda
precisa ser rotacionado. **Este arquivo não contém segredo** — a regra do
[`AGENTS.md`](../AGENTS.md) vale para ele como para qualquer outro: nenhum
arquivo versionado leva credencial, nem para documentar um vazamento.

> **Procedência:** este registro nasceu na branch local
> `karellima/onda1-rotacao-credenciais`, que nunca foi enviada ao remoto. Foi
> recuperado para a `main` em 2026-08-12, com os valores das credenciais
> removidos. O conteúdo original permanece acessível no histórico do Git.

## O que foi exposto

As credenciais abaixo pertencem ao sistema `Fborgess/financas-pessoais` e
estavam em texto plano no `AGENTS.md` deste repositório, em commits até
`c009dd1` (inclusive).

| Credencial | Risco | Status |
|---|---|---|
| Login de admin da API de produção | Acesso total à API | **Aguardando rotação pelo dono** |
| Identificador do projeto Neon | Expõe infraestrutura; não é segredo | Documentado |
| URL pública da aplicação no Render | Já era pública | N/A |
| Handle do GitHub do proprietário | Já era público | N/A |

Os valores estão nos commits anteriores a `c009dd1`. Não os reproduza em
nenhum arquivo versionado, inclusive neste.

## Ações pendentes — dono do `financas-pessoais`

### 1. Rotacionar a senha do admin — urgente e não resolvido

A senha está em commits públicos do GitHub. Qualquer pessoa com acesso a esses
commits consegue autenticar-se na API de produção.

1. Entrar na aplicação com a credencial atual.
2. Trocar a senha por um valor forte e único.
3. Guardar a nova senha em gerenciador de senhas (1Password, Bitwarden ou
   equivalente).
4. **Não** escrever a nova senha em nenhum arquivo versionado.

### 2. Entender o alcance real

Os commits com a senha continuam no histórico do Git e são publicamente
acessíveis. **A rotação é a única mitigação real:** reescrever o histórico não
alcança clones, forks e caches já existentes.

### 3. Expurgo do histórico — opcional, baixa prioridade

Reescrever o histórico com `git filter-branch` ou `git filter-repo` é possível,
mas force-push quebra os clones de qualquer colaborador e **não** remove o
conteúdo de cópias já feitas. Só faz sentido depois da rotação, e nunca no
lugar dela.

### 4. Conferir a connection string do banco

A `DATABASE_URL` do Neon não está versionada — vive como variável de ambiente.
Confirme que não vazou por log de build ou arquivo auxiliar:

```bash
git log --all -p | grep -i "DATABASE_URL"
```

Se aparecer, gere uma nova no painel do Neon e atualize a variável no ambiente
de execução.

### 5. Revisar o `AGENTS.md` do `financas-pessoais`

Garantir que aquele repositório também não tenha credencial embutida, seguindo
o mesmo padrão: variável de ambiente e gerenciador de senhas.

## O que este repositório já corrigiu

- O `AGENTS.md` não contém mais credencial em texto plano e registra o incidente
  explicitamente.
- O seed só cria administrador quando `ADMIN_EMAIL` e `ADMIN_PASSWORD` vêm do
  ambiente — não há mais credencial padrão.
- Arquivos de ambiente estão no `.gitignore`.

## A regra, daqui em diante

Nenhum arquivo versionado leva senha, connection string de produção, token de
API ou chave secreta — nem de desenvolvimento, nem para fins de documentação.
Credenciais vivem em variável de ambiente (`.env` local, `.env.ionos` no
servidor, ambos fora do Git) e em gerenciador de senhas.
