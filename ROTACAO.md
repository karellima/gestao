# Rotação de credenciais — financas-pessoais

Este documento registra as credenciais do sistema `Fborgess/financas-pessoais` que foram
expostas em commits anteriores deste repositório (`gestao`) e o que precisa ser
rotacionado pelo dono do repo `financas-pessoais`.

## O que foi exposto

| Credencial | Onde estava | Risco | Status |
|---|---|---|---|
| Login de admin: `admin@financas.com` / `admin123` | `AGENTS.md` (antes de 2026-08-10) | Acesso total à API de produção | **Aguardando rotação pelo dono** |
| Neon project ID: `org-bitter-term-46439512` | `AGENTS.md` (antes de 2026-08-10) | Identificação do projeto (não é segredo, mas expõe infra) | Documentado |
| Render app URL: `financas-pessoais-3udv.onrender.com` | `AGENTS.md` (antes de 2026-08-10) | URL pública (já visível) | N/A |
| GitHub owner: `Fborgess` | `AGENTS.md` (antes de 2026-08-10) | Handle público | N/A |

## Ações pendentes — dono do `financas-pessoais`

### 1. Rotacionar senha do admin (URGENTE)

A senha `admin123` está em commits públicos do GitHub. Qualquer pessoa com acesso
a esses commits pode autenticar-se na API de produção.

**Passos:**

1. Acesse `https://financas-pessoais-3udv.onrender.com`
2. Faça login com `admin@financas.com` / `admin123`
3. Altere a senha para um valor forte e único
4. Armazene a nova senha em um gerenciador de senhas (ex: 1Password, Bitwarden)
5. **Não** reescreva a nova senha em nenhum arquivo versionado

### 2. Verificar histórico de commits do GitHub

Os commits anteriores a `c009dd1` (e o próprio `c009dd1`) no repo `gestao` continham
a senha em texto plano. Esses commits permanecem no histórico do Git e são acessíveis
publicamente. A rotação da senha é a única mitigação real — reescrever o histórico
não impede que clones/caches já existentes contenham a credencial.

### 3. Considerar expurgo do histórico (opcional, baixa prioridade)

Se o dono do `Fborgess/gestao` quiser remover os commits do histórico:

```bash
git filter-branch --force --tree-filter 'sed -i "/admin123/d" AGENTS.md 2>/dev/null || true' -- --all
git push --force origin main
```

**Cuidado**: force-push quebra clones de outros colaboradores e não remove o conteúdo
de forks/clones já existentes. A rotação da senha é a mitigação mais importante.

### 4. Rever DATABASE_URL do Neon

A connection string do Neon **não** está no código versionado (está definida como
variável de ambiente `DATABASE_URL` no Render). Confirme que a string de conexão
não foi exposta em logs de build ou outros arquivos versionados.

**Verificação rápida:**
```bash
# No repo financas-pessoais, rode:
git log --all -p | grep -i "DATABASE_URL" | grep -v "^[+-].*DATABASE_URL"
```

Se a connection string aparecer, gere uma nova no dashboard do Neon e atualize a
variável `DATABASE_URL` no Render.

### 5. Atualizar AGENTS.md no repo `financas-pessoais`

O `AGENTS.md` do repo `financas-pessoais` deve ser revisado para garantir que também
não contenha credenciais hardcoded. Seguir o mesmo padrão: referenciar variáveis
de ambiente e gerenciador de senhas para credenciais.

## O que este repo (gestao) já fez

- ✂️ `AGENTS.md` não contém mais credenciais em texto plano — referencia o
  gerenciador de senhas do projeto
- 📄 `ROTACAO.md` (este arquivo) documenta o que precisa ser rotacionado e por quem
- 🔒 `backup.env` está no `.gitignore` — a `PROD_DATABASE_URL` do backup NÃO é versionada

## Convenção daqui pra frente

Nenhum arquivo versionado neste repositório ou no `financas-pessoais` deve conter:

- Senhas (mesmo de desenvolvimento)
- Connection strings de produção
- Tokens de API
- Chaves secretas

Credenciais vão **exclusivamente** em:
- Variáveis de ambiente (`.env` local, NÃO versionado)
- Variáveis de ambiente do Render (dashboard, NÃO no `render.yaml`)
- Gerenciador de senhas do projeto (ex: compartilhado via 1Password/Bitwarden entre os
  mantenedores)
