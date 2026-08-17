import { describe, expect, it } from 'vitest';
import { montarDadosDoPedido } from '../pages/venda/pedido-pdf';

const vendaBase = {
  id: 42,
  contact_name: 'Cliente Teste',
  sale_type_name: 'Balcão',
  status: 'aberto',
  total_amount: 99.99,
  items: [
    { productName: 'Primeiro produto', quantity: 2, unitPrice: '12,50' },
    { productName: 'Segundo produto', quantity: 1, unitPrice: '3,00' },
  ],
};

describe('montarDadosDoPedido', () => {
  it('mantém as linhas na ordem dos itens', () => {
    const dados = montarDadosDoPedido(vendaBase);

    expect(dados.linhas.map(linha => linha[0])).toEqual(['Primeiro produto', 'Segundo produto']);
  });

  it('calcula o total de cada linha com duas casas', () => {
    const dados = montarDadosDoPedido(vendaBase);

    expect(dados.linhas.map(linha => linha[3])).toEqual(['R$ 25.00', 'R$ 3.00']);
  });

  it('usa total_amount da venda no rodapé', () => {
    const dados = montarDadosDoPedido(vendaBase);

    expect(dados.rodape).toEqual(['', '', 'Total:', 'R$ 99.99']);
  });

  it('não cria observação quando a venda não tem notes', () => {
    const dados = montarDadosDoPedido(vendaBase);

    expect(dados.observacao).toBeNull();
  });

  it('usa hífen para contato e tipo ausentes', () => {
    const dados = montarDadosDoPedido({ ...vendaBase, contact_name: undefined, sale_type_name: undefined });

    expect(dados.cabecalho.cliente).toBe('Cliente: -');
    expect(dados.cabecalho.tipo).toBe('Tipo: -');
  });
});
