export function formVazio() {
  return {
    name: '', contact_type: 'cliente', cpf_cnpj: '', segment: '', email: '',
    phone: '', address: '', cep: '', city: '', state: '', notes: '', price_table_id: '',
  };
}

function orEmpty(value) {
  return value || '';
}

export function mapContatoToForm(c) {
  return {
    name: c.name,
    contact_type: c.contact_type,
    cpf_cnpj: orEmpty(c.cpf_cnpj),
    segment: orEmpty(c.segment),
    email: orEmpty(c.email),
    phone: orEmpty(c.phone),
    address: orEmpty(c.address),
    cep: orEmpty(c.cep),
    city: orEmpty(c.city),
    state: orEmpty(c.state),
    notes: orEmpty(c.notes),
    price_table_id: orEmpty(c.price_table_id),
  };
}

export function buildContatoPayload(form) {
  return {
    ...form,
    price_table_id: form.price_table_id ? parseInt(form.price_table_id) : null,
  };
}
