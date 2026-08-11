"""Comando de reparo do estoque.

    python -m app.cli.repair_stock             # simula (dry-run) e imprime o relatório
    python -m app.cli.repair_stock --apply     # aplica as correções
    python -m app.cli.repair_stock --json      # relatório em JSON, para arquivar

Roda fora do boot do app de propósito: reparo é decisão humana, não efeito
colateral de deploy. Ver :mod:`app.services.stock_repair`.
"""

import argparse
import json
import logging
import sys

from sqlalchemy import inspect

# Registra todos os modelos no metadata antes de abrir sessão.
import app.models  # noqa: F401
from app.database import SessionLocal, engine
from app.services.stock_repair import repair_stock

#: Tabelas que o reparo lê. Faltar alguma significa banco errado ou nunca migrado.
TABELAS_NECESSARIAS = ("stock_movements", "requisicoes", "products")


def _format_report(relatorio: dict) -> str:
    linhas = []
    modo = "SIMULAÇÃO (nada foi gravado)" if relatorio["dry_run"] else "APLICADO"
    linhas.append(f"Reparo de estoque — {modo}")
    linhas.append(f"Executado em: {relatorio['executed_at']}")
    linhas.append("")

    orfas = relatorio["orphan_requisicao_exits"]
    linhas.append(f"Saídas de requisições não recebidas: {len(orfas)}")
    for o in orfas:
        linhas.append(
            f"  mov #{o['movement_id']} · requisição #{o['requisicao_id']} · "
            f"produto {o['product_id']} · qtd {o['quantity']}"
        )

    compensacoes = relatorio["compensations_created"]
    verbo = "seriam criadas" if relatorio["dry_run"] else "criadas"
    linhas.append("")
    linhas.append(f"Compensações {verbo}: {len(compensacoes)}")
    for c in compensacoes:
        destino = f" → mov #{c['compensation_id']}" if c["compensation_id"] else ""
        linhas.append(f"  estorno de mov #{c['movement_id']} (qtd {c['quantity']}){destino}")

    divergencias = relatorio["stock_divergences"]
    verbo = "seriam corrigidos" if relatorio["dry_run"] else "corrigidos"
    linhas.append("")
    linhas.append(f"Saldos divergentes do histórico ({verbo}): {len(divergencias)}")
    for d in divergencias:
        linhas.append(
            f"  produto {d['product_id']} · {d['product_name']}: "
            f"{d['current_stock']} → {d['derived_stock']} (delta {d['delta']:+g})"
        )

    if relatorio["dry_run"]:
        linhas.append("")
        linhas.append("Nada foi gravado. Rode de novo com --apply para aplicar.")
    return "\n".join(linhas)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="repair_stock",
        description="Repara o estoque por compensação, sem apagar histórico.",
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="grava as correções (sem esta flag o comando só simula)",
    )
    parser.add_argument("--json", action="store_true", help="imprime o relatório em JSON")
    parser.add_argument(
        "--user-id", type=int, default=None,
        help="id do usuário responsável, registrado nas compensações",
    )
    parser.add_argument(
        "--skip-orphans", action="store_true",
        help="não compensa saídas de requisições não recebidas",
    )
    parser.add_argument(
        "--skip-resync", action="store_true",
        help="não re-sincroniza o cache products.current_stock",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # O reparo não cria schema — se as tabelas não existem, o alvo está errado.
    faltando = sorted(set(TABELAS_NECESSARIAS) - set(inspect(engine).get_table_names()))
    if faltando:
        print(
            f"Banco sem as tabelas {', '.join(faltando)} — confira o DATABASE_URL.\n"
            f"Alvo atual: {engine.url.render_as_string(hide_password=True)}",
            file=sys.stderr,
        )
        return 1

    with SessionLocal() as session:
        relatorio = repair_stock(
            session,
            dry_run=not args.apply,
            user_id=args.user_id,
            compensate_orphans=not args.skip_orphans,
            resync_cache=not args.skip_resync,
        )

    print(json.dumps(relatorio, indent=2, ensure_ascii=False) if args.json else _format_report(relatorio))
    return 0


if __name__ == "__main__":
    sys.exit(main())
