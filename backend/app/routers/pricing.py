
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pricing import ProductPricing
from app.models.product import Product
from app.schemas.pricing import ApplyResult, PricingInput, PricingResponse, PricingResult
from app.utils.security import require_module

router = APIRouter(prefix="/api/pricing", tags=["Precificação de Produtos"])

FIELDS = [
    "acquisition_price", "lote", "avarias_pct", "comissao_pct", "frete_pct",
    "outros_custos_pct", "recursos_humanos_pct", "taxa_cartao_pct",
    "taxas_antecipacao_pct", "margem_alvo", "impostos_pct",
]


def calculate(data: PricingInput) -> PricingResult:
    lote = data.lote if data.lote else 1
    custo_unitario = data.acquisition_price / lote
    total_deducoes = (
        data.avarias_pct + data.comissao_pct + data.frete_pct
        + data.outros_custos_pct + data.recursos_humanos_pct
        + data.taxa_cartao_pct + data.taxas_antecipacao_pct
    )
    custos_variaveis = custo_unitario * total_deducoes
    total_custos = custo_unitario + custos_variaveis
    divisor = 1 - data.margem_alvo - data.impostos_pct
    if divisor <= 0:
        raise HTTPException(400, "A soma da margem alvo e impostos deve ser menor que 100%")
    preco_venda = total_custos / divisor

    custos_diretos = custo_unitario
    despesas_variaveis = custos_variaveis
    impostos_rs = preco_venda * data.impostos_pct
    total_custos_rs = custos_diretos + despesas_variaveis + impostos_rs
    margem_rs = preco_venda - total_custos_rs
    margem_pct = margem_rs / preco_venda if preco_venda else 0
    markup_multiplicador = preco_venda / custo_unitario if custo_unitario else 0

    return PricingResult(
        custo_unitario=round(custo_unitario, 6),
        total_deducoes_pct=round(total_deducoes, 4),
        custos_variaveis=round(custos_variaveis, 6),
        total_custos=round(total_custos, 6),
        preco_venda=round(preco_venda, 6),
        custos_diretos=round(custos_diretos, 6),
        despesas_variaveis=round(despesas_variaveis, 6),
        impostos_rs=round(impostos_rs, 6),
        total_custos_rs=round(total_custos_rs, 6),
        margem_rs=round(margem_rs, 6),
        margem_pct=round(margem_pct, 4),
        markup_multiplicador=round(markup_multiplicador, 4),
        markup_resultado=round(preco_venda, 6),
    )


def _to_response(p: ProductPricing) -> PricingResponse:
    product = p.product
    return PricingResponse(
        id=p.id,
        product_id=p.product_id,
        acquisition_price=p.acquisition_price,
        lote=p.lote,
        avarias_pct=p.avarias_pct,
        comissao_pct=p.comissao_pct,
        frete_pct=p.frete_pct,
        outros_custos_pct=p.outros_custos_pct,
        recursos_humanos_pct=p.recursos_humanos_pct,
        taxa_cartao_pct=p.taxa_cartao_pct,
        taxas_antecipacao_pct=p.taxas_antecipacao_pct,
        margem_alvo=p.margem_alvo,
        impostos_pct=p.impostos_pct,
        product_name=product.name if product else None,
        display_name=product.display_name if product else None,
        cost_price=product.cost_price if product else None,
        price=product.price if product else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


WEIGHT_ABBR = {"kg", "g", "mg", "cg", "dg", "hg", "t", "ton"}


def _unit_decimals(product) -> int:
    if product and product.unit and product.unit.abbreviation:
        return 3 if product.unit.abbreviation.lower().replace(".", "") in WEIGHT_ABBR else 2
    return 2


def _update_product_from_pricing(product, result: PricingResult):
    """Atualiza Preço de Custo, Markup e Preço de Venda no cadastro do produto."""
    if not product or result.custo_unitario <= 0:
        return
    d = _unit_decimals(product)
    product.cost_price = round(result.custo_unitario, d)
    product.markup = round(result.markup_multiplicador, 4)
    product.price = round(result.preco_venda, d)


@router.post("/calculate", response_model=PricingResult)
def calculate_pricing(
    data: PricingInput,
    _=Depends(require_module("precificacao")),
):
    return calculate(data)


@router.get("/", response_model=list[PricingResponse])
def list_pricings(
    db: Session = Depends(get_db),
    _=Depends(require_module("precificacao")),
):
    return [_to_response(p) for p in db.query(ProductPricing).all()]


@router.get("/{product_id}", response_model=PricingResponse)
def get_pricing(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("precificacao")),
):
    p = db.query(ProductPricing).filter(ProductPricing.product_id == product_id).first()
    if not p:
        raise HTTPException(404, "Precificação não encontrada para este produto")
    return _to_response(p)


@router.post("/", response_model=PricingResponse, status_code=201)
def save_pricing(
    data: PricingInput,
    db: Session = Depends(get_db),
    _=Depends(require_module("precificacao", "edit")),
):
    if not data.product_id:
        raise HTTPException(400, "Informe o produto")
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(404, "Produto não encontrado")
    existing = db.query(ProductPricing).filter(ProductPricing.product_id == data.product_id).first()
    if existing:
        for field in FIELDS:
            setattr(existing, field, getattr(data, field))
        db.commit()
        db.refresh(existing)
    else:
        existing = ProductPricing(product_id=data.product_id, **data.model_dump(exclude={"product_id"}))
        db.add(existing)
        db.commit()
        db.refresh(existing)
    _update_product_from_pricing(product, calculate(data))
    db.commit()
    return _to_response(existing)


@router.delete("/{product_id}")
def delete_pricing(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_module("precificacao", "edit")),
):
    p = db.query(ProductPricing).filter(ProductPricing.product_id == product_id).first()
    if not p:
        raise HTTPException(404, "Precificação não encontrada")
    db.delete(p)
    db.commit()
    return {"message": "Precificação removida"}


@router.post("/{product_id}/apply", response_model=ApplyResult)
def apply_price(
    product_id: int,
    data: PricingInput,
    db: Session = Depends(get_db),
    _=Depends(require_module("precificacao", "edit")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Produto não encontrado")
    result = calculate(data)
    existing = db.query(ProductPricing).filter(ProductPricing.product_id == product_id).first()
    if existing:
        for field in FIELDS:
            setattr(existing, field, getattr(data, field))
    else:
        db.add(ProductPricing(product_id=product_id, **data.model_dump(exclude={"product_id"})))
    product.price = result.preco_venda
    _update_product_from_pricing(product, result)
    db.commit()
    db.refresh(product)
    return ApplyResult(
        result=result,
        product={
            "id": product.id,
            "name": product.name,
            "display_name": product.display_name,
            "price": product.price,
        },
    )
