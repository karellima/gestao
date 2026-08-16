import { describe, expect, it } from 'vitest';
import { getVisibleItems, getVisibleSections } from '../components/navegacao/permissoes-do-menu';

const section = {
  label: 'Financeiro',
  items: [
    { path: '/financial', label: 'Lançamentos' },
    { path: '/custom', label: 'Sem módulo' },
  ],
};

describe('permissões do menu', () => {
  it('mostra tudo enquanto as permissões ainda não carregaram', () => {
    expect(getVisibleItems(section, undefined)).toEqual(section.items);
  });

  it('mostra itens que não têm módulo mapeado', () => {
    expect(getVisibleItems(section, { financial: false })).toEqual([section.items[1]]);
  });

  it('remove itens cujo módulo está sem permissão', () => {
    expect(getVisibleItems(section, { financial: false })).not.toContain(section.items[0]);
  });

  it('remove uma seção vazia, exceto Geral', () => {
    const sections = [
      { label: 'Vazia', items: [{ path: '/financial', label: 'Lançamentos' }] },
      { label: 'Geral', items: [{ path: '/', label: 'Dashboard' }] },
    ];
    expect(getVisibleSections(sections, { financial: false, dashboard: false }).map(item => item.label)).toEqual(['Geral']);
  });

  it('trata a permissão view como verdadeira', () => {
    expect(getVisibleItems(section, { financial: 'view' })).toContain(section.items[0]);
  });
});
