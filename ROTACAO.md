# Rotação de credencial exposta

Um commit antigo deste repositório publicou, em texto plano no `AGENTS.md`, o login
de administrador da produção do sistema **`financas-pessoais`** — outro projeto do
mesmo dono. Este documento registra o incidente e o que falta fazer.

**A senha não é repetida aqui.** Ela está no commit `a93c6c8` e nos que vieram
depois, até a limpeza. Documentar o vazamento não é motivo para publicá-lo de novo
num arquivo que também vai para o GitHub.

## Situação

| Item | Onde estava | Situação |
|---|---|---|
| Login de admin do `financas-pessoais` | `AGENTS.md`, até a limpeza de 2026-08-10 | **Pendente de rotação pelo dono** |
| ID do projeto Neon | `AGENTS.md`, até a limpeza | Não é segredo, mas expõe a infraestrutura |
| URL pública do app no Render | `AGENTS.md` | Já era pública, sem ação |

O commit que introduziu a credencial é ancestral da `main` de dois repositórios
públicos: `Fborgess/gestao` e o fork `karellima/gestao`. Enquanto a limpeza não for
publicada, a senha aparece no arquivo atual, não só no histórico.

## O que fazer, nesta ordem

### 1. Rotacionar a senha — dono do `financas-pessoais`

É a única mitigação real. Enquanto a senha valer, tanto faz o que se faça com o
histórico: quem já clonou tem a credencial.

1. Entrar no sistema de produção com o acesso atual.
2. Trocar por uma senha forte e única.
3. Guardar a nova senha num gerenciador (1Password, Bitwarden, o que o time usar).
4. Não escrever a nova senha em nenhum arquivo versionado — em lugar nenhum.

### 2. Publicar esta limpeza

Depois da rotação. Subir antes funciona, mas chama atenção para a credencial ainda
válida: o diff mostra exatamente o que foi removido, e o commit é recente.

Com a limpeza publicada, a senha some do arquivo atual dos dois repositórios. Quem
abrir o repositório deixa de encontrá-la; quem procurar no histórico ainda acha.

### 3. Revisar o `AGENTS.md` do `financas-pessoais`

O mesmo padrão pode estar lá. Credencial de produção não vai em arquivo versionado,
nem para uso de agente: vai em variável de ambiente e em gerenciador de senhas.

### 4. Confirmar que a connection string do Neon não vazou

Ela não está no código versionado deste repositório — é variável de ambiente no
Render. Vale confirmar que também não apareceu em log de build ou em outro arquivo
versionado do `financas-pessoais`:

```bash
git log --all -p | grep -i "DATABASE_URL"
```

Se aparecer, gerar uma nova no painel do Neon e atualizar a variável.

### 5. Expurgo do histórico — opcional, e não substitui a rotação

Reescrever o histórico com `git filter-repo` e force-push **não resolve o vazamento**:

- o fork já propagou os commits;
- o GitHub mantém commits órfãos acessíveis por hash mesmo depois do force-push;
- clones e caches de terceiros continuam intactos;
- e o force-push quebra o trabalho de quem tiver o repositório clonado.

Faz sentido apenas como faxina, depois da rotação, e combinado entre os dois donos.

## O que já foi feito neste repositório

- A credencial saiu do `AGENTS.md`.
- `backup.env` está no `.gitignore`; a `PROD_DATABASE_URL` do backup não é versionada.
- O sistema deixou de ter administrador padrão: só existe usuário inicial quando
  `ADMIN_EMAIL` e `ADMIN_PASSWORD` são definidos no ambiente.

## Convenção daqui em diante

Nenhum arquivo versionado leva senha (nem de desenvolvimento), connection string de
produção, token de API ou chave secreta. Credencial vive em variável de ambiente
(`.env` local, `.env.ionos` no servidor, ambos fora do git) e em gerenciador de
senhas compartilhado entre os mantenedores.
