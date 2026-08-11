#!/usr/bin/env python3
"""Quality gate em catraca (ratchet).

Coleta as mesmas métricas do baseline.json, compara, e falha se qualquer uma
piorou. Um commit pode adicionar código; não pode piorar nenhum número.

    python3 quality/gate.py                    # compara com o baseline
    python3 quality/gate.py --write-baseline   # congela o estado atual
    python3 quality/gate.py --no-tests         # pula cobertura (rodada rápida)

Ferramentas usadas: ruff, lizard, grimp, pytest-cov (backend/.venv) e
eslint, jscpd, madge (frontend/node_modules). Versões pinadas em
backend/requirements-dev.txt e frontend/package.json — os números do baseline
só são reprodutíveis com elas.
"""

import argparse
import csv
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "quality" / "baseline.json"
REPORT = ROOT / "quality" / "report.md"

PY_SRC = ROOT / "backend" / "app"
PY_TESTS = ROOT / "backend" / "tests"
JS_SRC = ROOT / "frontend" / "src"

VENV_PY = ROOT / "backend" / ".venv" / "bin" / "python"
NODE_BIN = ROOT / "frontend" / "node_modules" / ".bin"

# Tetos. Não são metas de refatoração — só definem o que conta como "acima".
CCN_CEILING = 10
FILE_LINE_LIMIT = 300

# direction: "down" = menor é melhor, "up" = maior é melhor.
METRICS = {
    "lint_ruff": ("Violações de lint — backend (ruff)", "down"),
    "lint_eslint": ("Violações de lint — frontend (eslint)", "down"),
    "complexity_over_ceiling": (f"Funções com complexidade > {CCN_CEILING}", "down"),
    "complexity_max": ("Pior complexidade ciclomática do repo", "down"),
    "coverage_backend_pct": ("Cobertura de testes — backend (%)", "up"),
    "duplication_pct": ("Duplicação de código (%)", "down"),
    "files_over_limit": (f"Arquivos com mais de {FILE_LINE_LIMIT} linhas", "down"),
    "largest_file_lines": ("Maior arquivo (linhas)", "down"),
    "import_cycles": ("Ciclos de importação", "down"),
}


def die(msg):
    print(f"gate: {msg}", file=sys.stderr)
    sys.exit(2)


def run(cmd, cwd, allow_fail=True):
    """Roda um coletor. Coletores sinalizam achados via exit code != 0, então
    exit code sozinho não distingue 'achou problemas' de 'quebrou'."""
    proc = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, check=False
    )
    if not allow_fail and proc.returncode != 0:
        die(f"comando falhou: {' '.join(str(c) for c in cmd)}\n{proc.stderr}")
    return proc


def check_tools():
    if not VENV_PY.exists():
        die(
            "backend/.venv não existe. Crie com:\n"
            "  uv venv --python 3.12 backend/.venv\n"
            "  uv pip install --python backend/.venv/bin/python -r backend/requirements-dev.txt"
        )
    for tool in ("eslint", "jscpd", "madge"):
        if not (NODE_BIN / tool).exists():
            die(f"{tool} não encontrado. Rode: npm install --prefix frontend")


# --------------------------------------------------------------------------
# coletores
# --------------------------------------------------------------------------


def collect_ruff():
    proc = run([str(VENV_PY), "-m", "ruff", "check", "app", "tests",
                "--output-format", "json"], cwd=ROOT / "backend")
    try:
        return len(json.loads(proc.stdout))
    except json.JSONDecodeError:
        die(f"ruff não devolveu JSON:\n{proc.stdout[:500]}{proc.stderr[:500]}")


def collect_eslint():
    proc = run([str(NODE_BIN / "eslint"), "src", "--format", "json"],
               cwd=ROOT / "frontend")
    try:
        files = json.loads(proc.stdout)
    except json.JSONDecodeError:
        die(f"eslint não devolveu JSON:\n{proc.stdout[:500]}{proc.stderr[:500]}")
    return sum(f["errorCount"] + f["warningCount"] for f in files)


def collect_lizard():
    """Complexidade por função. Uma passada por árvore: o lizard detecta a
    linguagem pela extensão, e passar as duas juntas atrapalha isso."""
    rows = []
    for target in (PY_SRC, JS_SRC):
        proc = run([str(ROOT / "backend" / ".venv" / "bin" / "lizard"),
                    str(target), "--csv"], cwd=ROOT)
        rows.extend(csv.reader(io.StringIO(proc.stdout)))
    ccns = [int(r[1]) for r in rows if len(r) > 1 and r[1].isdigit()]
    if not ccns:
        die("lizard não devolveu nenhuma função — coletor quebrado")
    return {
        "complexity_over_ceiling": sum(1 for c in ccns if c > CCN_CEILING),
        "complexity_max": max(ccns),
    }


def collect_file_sizes():
    sizes = []
    for target in (PY_SRC, JS_SRC):
        for path in target.rglob("*"):
            if path.suffix in (".py", ".js", ".jsx") and path.is_file():
                with path.open(encoding="utf-8", errors="replace") as fh:
                    sizes.append(sum(1 for _ in fh))
    if not sizes:
        die("nenhum arquivo de código encontrado — coletor quebrado")
    return {
        "files_over_limit": sum(1 for s in sizes if s > FILE_LINE_LIMIT),
        "largest_file_lines": max(sizes),
    }


def collect_coverage():
    tmp = Path(tempfile.mkdtemp(prefix="gate-cov-"))
    try:
        proc = run([str(VENV_PY), "-m", "pytest", "tests/", "-q",
                    "--cov=app", f"--cov-report=json:{tmp / 'cov.json'}"],
                   cwd=ROOT / "backend")
        out = tmp / "cov.json"
        if not out.exists():
            die(f"pytest não gerou relatório de cobertura:\n{proc.stdout[-2000:]}")
        # Suíte vermelha invalida a cobertura: não dá pra dizer que a métrica
        # empatou se os testes nem passam.
        if proc.returncode != 0:
            die(f"a suíte de testes falhou — corrija antes do gate:\n{proc.stdout[-2000:]}")
        return round(json.loads(out.read_text())["totals"]["percent_covered"], 2)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def collect_duplication():
    tmp = Path(tempfile.mkdtemp(prefix="gate-jscpd-"))
    try:
        run([str(NODE_BIN / "jscpd"), str(PY_SRC), str(JS_SRC),
             "--reporters", "json", "--output", str(tmp), "--silent",
             "--min-lines", "5", "--min-tokens", "50"], cwd=ROOT)
        out = tmp / "jscpd-report.json"
        if not out.exists():
            die("jscpd não gerou relatório")
        return round(json.loads(out.read_text())["statistics"]["total"]["percentage"], 2)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def collect_cycles():
    """Check binário nas duas pontas: existe ciclo ou não."""
    cycles = 0

    proc = run([str(VENV_PY), "-c",
                "import grimp, json;"
                "g = grimp.build_graph('app');"
                "print(json.dumps(sum(1 for m in g.modules"
                " for o in g.find_modules_directly_imported_by(m)"
                " if g.find_shortest_chain(o, m))))"],
               cwd=ROOT / "backend")
    try:
        cycles += json.loads(proc.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        die(f"grimp falhou:\n{proc.stdout[:500]}{proc.stderr[:500]}")

    proc = run([str(NODE_BIN / "madge"), "--circular", "--json",
                "--extensions", "js,jsx", "src"], cwd=ROOT / "frontend")
    try:
        cycles += len(json.loads(proc.stdout))
    except json.JSONDecodeError:
        die(f"madge falhou:\n{proc.stdout[:500]}{proc.stderr[:500]}")

    return cycles


def collect_all(with_tests=True):
    print("gate: coletando métricas...", file=sys.stderr)
    metrics = {}
    print("  ruff...", file=sys.stderr)
    metrics["lint_ruff"] = collect_ruff()
    print("  eslint...", file=sys.stderr)
    metrics["lint_eslint"] = collect_eslint()
    print("  lizard...", file=sys.stderr)
    metrics.update(collect_lizard())
    print("  tamanho de arquivos...", file=sys.stderr)
    metrics.update(collect_file_sizes())
    print("  jscpd...", file=sys.stderr)
    metrics["duplication_pct"] = collect_duplication()
    print("  ciclos...", file=sys.stderr)
    metrics["import_cycles"] = collect_cycles()
    if with_tests:
        print("  pytest + cobertura (demora ~1min)...", file=sys.stderr)
        metrics["coverage_backend_pct"] = collect_coverage()
    return metrics


# --------------------------------------------------------------------------
# comparação e report
# --------------------------------------------------------------------------


def compare(base, current):
    rows = []
    for key, (label, direction) in METRICS.items():
        if key not in current:
            rows.append((key, label, base.get(key), None, "pulado"))
            continue
        if key not in base:
            rows.append((key, label, None, current[key], "novo"))
            continue
        b, c = base[key], current[key]
        if direction == "down":
            status = "piorou" if c > b else ("melhorou" if c < b else "ok")
        else:
            status = "piorou" if c < b else ("melhorou" if c > b else "ok")
        rows.append((key, label, b, c, status))
    return rows


def write_report(rows, failed):
    lines = [
        "# Quality gate — report",
        "",
        "Gerado por `quality/gate.py`. Baseline em `quality/baseline.json`.",
        "",
        f"**Resultado: {'FALHOU' if failed else 'PASSOU'}**",
        "",
        "| Métrica | Baseline | Atual | Situação |",
        "|---|---:|---:|---|",
    ]
    icon = {"ok": "= ok", "melhorou": "▼ melhorou", "piorou": "✗ PIOROU",
            "pulado": "– pulado", "novo": "+ novo"}
    for _key, label, b, c, status in rows:
        fmt = lambda v: "—" if v is None else str(v)  # noqa: E731
        lines.append(f"| {label} | {fmt(b)} | {fmt(c)} | {icon[status]} |")

    if failed:
        lines += [
            "",
            "## O que reprovou",
            "",
        ]
        for _key, label, b, c, status in rows:
            if status == "piorou":
                lines.append(f"- **{label}**: era `{b}`, virou `{c}`.")
        lines += [
            "",
            "A regra é catraca: dá pra adicionar código, não dá pra piorar número.",
            "Ou você desfaz a piora, ou compensa em outro ponto até empatar.",
            "",
            "Se a piora for deliberada e justificada, atualize o baseline de propósito",
            "(`python3 quality/gate.py --write-baseline`) e explique no commit — assim",
            "fica um registro em vez de uma erosão silenciosa.",
        ]
    else:
        lines += ["", "Nenhuma métrica piorou.", ""]

    lines += [
        "",
        "---",
        "",
        "Os números não pegam tudo. Antes de aprovar, passe pela rubrica humana em",
        "[`quality/review.md`](review.md).",
        "",
    ]
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-baseline", action="store_true",
                    help="congela o estado atual em quality/baseline.json")
    ap.add_argument("--no-tests", action="store_true",
                    help="pula pytest/cobertura (rodada rápida; não vale como gate)")
    args = ap.parse_args()

    check_tools()
    current = collect_all(with_tests=not args.no_tests)

    if args.write_baseline:
        if args.no_tests:
            die("--write-baseline exige a cobertura; rode sem --no-tests")
        BASELINE.parent.mkdir(exist_ok=True)
        BASELINE.write_text(
            json.dumps({
                "_comment": "Estado congelado do repo. Não edite à mão: "
                            "rode 'python3 quality/gate.py --write-baseline'.",
                "ccn_ceiling": CCN_CEILING,
                "file_line_limit": FILE_LINE_LIMIT,
                "metrics": current,
            }, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"gate: baseline congelado em {BASELINE.relative_to(ROOT)}")
        for k, v in current.items():
            print(f"  {k}: {v}")
        return 0

    if not BASELINE.exists():
        die("quality/baseline.json não existe. Rode com --write-baseline primeiro.")

    base = json.loads(BASELINE.read_text())["metrics"]
    rows = compare(base, current)
    failed = [r for r in rows if r[4] == "piorou"]
    write_report(rows, bool(failed))

    for _key, label, b, c, status in rows:
        mark = {"ok": "  =", "melhorou": "  ▼", "piorou": "  ✗",
                "pulado": "  –", "novo": "  +"}[status]
        print(f"{mark} {label}: {b} → {c}")

    print()
    if failed:
        print(f"gate: REPROVADO — {len(failed)} métrica(s) pioraram. "
              f"Detalhes em {REPORT.relative_to(ROOT)}")
        return 1
    print(f"gate: aprovado. Report em {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    os.chdir(ROOT)
    sys.exit(main())
