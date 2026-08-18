import { describe, expect, it } from 'vitest';
import { getVisibleItems, getVisibleSections } from '../components/navegacao/permissoes-do-menu';

const section = {
  label: 'Financeiro',
  items: [
    { path: '/financial', label: 'Lançamentos' },
    { path: '/custom', label: 'Sem módulo' },
  ],
};
const sections = [
  { label: 'Vazia', items: [{ path: '/financial', label: 'Lançamentos' }] },
  { label: 'Geral', items: [{ path: '/', label: 'Dashboard' }] },
];

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

  it('remove qualquer seção sem itens visíveis, inclusive Geral', () => {
    expect(getVisibleSections(sections, { financial: false, dashboard: false })).toEqual([]);
  });

  it('mostra Geral com Dashboard quando dashboard está permitido', () => {
    expect(getVisibleSections([sections[1]], { dashboard: true })).toEqual([sections[1]]);
  });

  it('mostra todas as seções enquanto as permissões ainda não carregaram', () => {
    expect(getVisibleSections(sections, undefined)).toEqual(sections);
  });

  it('trata a permissão view como verdadeira', () => {
    expect(getVisibleItems(section, { financial: 'view' })).toContain(section.items[0]);
  });
});
