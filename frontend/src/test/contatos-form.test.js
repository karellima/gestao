import { describe, expect, it } from 'vitest';
import { formVazio, mapContatoToForm, buildContatoPayload } from '../pages/contatos/contato-form';
import {
  fmtPhone, montarEnderecoCnpj, mapCnpjToForm, mapCepToForm,
} from '../pages/contatos/busca-externa';

const identity = (v) => v;

describe('fmtPhone', () => {
  it('formats 11 digits as mobile', () => {
    expect(fmtPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('formats 10 digits as landline', () => {
    expect(fmtPhone('1134567890')).toBe('(11) 3456-7890');
  });

  it('returns only digits for other lengths', () => {
    expect(fmtPhone('12345')).toBe('12345');
    expect(fmtPhone('(11) 123')).toBe('11123');
  });

  it('does not throw on null or undefined', () => {
    expect(fmtPhone(null)).toBe('');
    expect(fmtPhone(undefined)).toBe('');
  });
});

describe('mapContatoToForm', () => {
  it('turns null fields into empty string in all nine cases', () => {
    const form = mapContatoToForm({
      name: 'Acme',
      contact_type: 'cliente',
      cpf_cnpj: null,
      segment: null,
      email: null,
      phone: null,
      address: null,
      cep: null,
      city: null,
      state: null,
      notes: null,
      price_table_id: null,
    });
    expect(form.name).toBe('Acme');
    expect(form.contact_type).toBe('cliente');
    expect(form.cpf_cnpj).toBe('');
    expect(form.segment).toBe('');
    expect(form.email).toBe('');
    expect(form.phone).toBe('');
    expect(form.address).toBe('');
    expect(form.cep).toBe('');
    expect(form.city).toBe('');
    expect(form.state).toBe('');
    expect(form.notes).toBe('');
    expect(form.price_table_id).toBe('');
  });

  it('turns missing price_table_id into empty string', () => {
    const form = mapContatoToForm({ name: 'X', contact_type: 'cliente' });
    expect(form.price_table_id).toBe('');
  });
});

describe('formVazio / buildContatoPayload', () => {
  it('starts with empty fields and default type cliente', () => {
    const f = formVazio();
    expect(f.contact_type).toBe('cliente');
    expect(f.name).toBe('');
    expect(f.price_table_id).toBe('');
  });

  it('parses price_table_id or sends null', () => {
    expect(buildContatoPayload({ ...formVazio(), price_table_id: '7' }).price_table_id).toBe(7);
    expect(buildContatoPayload(formVazio()).price_table_id).toBe(null);
  });
});

describe('montarEnderecoCnpj (linha 145)', () => {
  it('returns falsy when address and form are both empty', () => {
    expect(montarEnderecoCnpj('', undefined, '', identity)).toBeFalsy();
    expect(montarEnderecoCnpj('', '', '', identity)).toBeFalsy();
  });

  it('keeps form address when address from CNPJ is empty', () => {
    expect(montarEnderecoCnpj('', 'Centro', 'Rua A', identity)).toBe('Rua A');
  });

  it('uses CNPJ address with neighborhood when address is filled', () => {
    expect(montarEnderecoCnpj('Rua X, 10', 'Centro', '', identity)).toBe('Rua X, 10 - Centro');
    expect(montarEnderecoCnpj('Rua X, 10', 'Centro', 'velho', identity)).toBe('Rua X, 10 - Centro');
  });
});

describe('mapCnpjToForm', () => {
  it('falls back name to razao_social when nome_fantasia is empty', () => {
    const form = mapCnpjToForm(
      { nome_fantasia: '', razao_social: 'Acme LTDA', logradouro: '', numero: '', complemento: '' },
      formVazio(),
      identity,
    );
    expect(form.name).toBe('Acme LTDA');
  });

  it('builds address skipping empty parts', () => {
    const form = mapCnpjToForm(
      {
        nome_fantasia: 'Loja',
        razao_social: 'Acme',
        logradouro: 'Rua A',
        numero: '',
        complemento: 'Sala 1',
        bairro: 'Centro',
      },
      formVazio(),
      identity,
    );
    expect(form.address).toBe('Rua A, Sala 1 - Centro');
  });

  it('formats CEP 12345678 as 12345-678', () => {
    const form = mapCnpjToForm(
      { nome_fantasia: 'X', razao_social: 'Y', cep: '12345678', logradouro: '', numero: '', complemento: '' },
      formVazio(),
      identity,
    );
    expect(form.cep).toBe('12345-678');
  });

  it('preserves existing form values when response fields are absent', () => {
    const prev = {
      ...formVazio(),
      email: 'a@b.com',
      phone: '(11) 1111-1111',
      address: 'Rua Velha',
      cep: '11111-111',
      city: 'Santos',
      state: 'SP',
    };
    const form = mapCnpjToForm(
      { nome_fantasia: 'Nova', razao_social: '', logradouro: '', numero: '', complemento: '' },
      prev,
      identity,
    );
    expect(form.email).toBe('a@b.com');
    expect(form.phone).toBe('(11) 1111-1111');
    expect(form.address).toBe('Rua Velha');
    expect(form.cep).toBe('11111-111');
    expect(form.city).toBe('Santos');
    expect(form.state).toBe('SP');
    expect(form.name).toBe('Nova');
  });
});

describe('mapCepToForm', () => {
  it('fills address only when form address is empty', () => {
    const filled = mapCepToForm(
      { street: 'Rua Nova', neighborhood: 'Bairro', city: 'Campinas', state: 'SP' },
      formVazio(),
      identity,
    );
    expect(filled.address).toBe('Rua Nova - Bairro');
    expect(filled.city).toBe('Campinas');
    expect(filled.state).toBe('SP');

    const kept = mapCepToForm(
      { street: 'Rua Nova', neighborhood: 'Bairro', city: 'Campinas', state: 'SP' },
      { ...formVazio(), address: 'Já tinha' },
      identity,
    );
    expect(kept.address).toBe('Já tinha');
  });

  it('preserves city and state when response omits them', () => {
    const form = mapCepToForm(
      { street: 'Rua', neighborhood: 'B' },
      { ...formVazio(), city: 'X', state: 'RJ' },
      identity,
    );
    expect(form.city).toBe('X');
    expect(form.state).toBe('RJ');
  });
});
