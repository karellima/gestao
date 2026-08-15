export const PERCENT_FIELDS = [
  'avarias_pct', 'comissao_pct', 'frete_pct', 'outros_custos_pct',
  'recursos_humanos_pct', 'taxa_cartao_pct', 'taxas_antecipacao_pct',
  'margem_alvo', 'impostos_pct',
];

export const PERCENT_LABELS = {
  avarias_pct: 'Avarias', comissao_pct: 'Comissão', frete_pct: 'Frete',
  outros_custos_pct: 'Outros custos', recursos_humanos_pct: 'Recursos humanos',
  taxa_cartao_pct: 'Taxa cartão crédito', taxas_antecipacao_pct: 'Taxas antecipação/cartão',
  margem_alvo: 'Margem de Lucro Alvo', impostos_pct: 'Impostos',
};

export const DEFAULTS = {
  acquisition_price: '',
  lote: 1,
  avarias_pct: '6', comissao_pct: '0', frete_pct: '5', outros_custos_pct: '0',
  recursos_humanos_pct: '5', taxa_cartao_pct: '0', taxas_antecipacao_pct: '0',
  margem_alvo: '20', impostos_pct: '6',
};

const PERCENT_STORAGE_KEY = 'pricing_base_percents_v1';

export const loadBasePercents = () => {
  try {
    const raw = localStorage.getItem(PERCENT_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null) return null;
    return obj;
  } catch { return null; }
};

export const saveBasePercents = (form) => {
  try {
    const obj = {};
    PERCENT_FIELDS.forEach(k => { obj[k] = form[k]; });
    localStorage.setItem(PERCENT_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* armazenamento local indisponível */ }
};

export const defaultForm = () => ({ ...DEFAULTS, ...loadBasePercents() });
