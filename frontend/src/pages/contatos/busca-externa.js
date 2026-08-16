export function fmtPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

export function montarEnderecoCnpj(address, bairro, formAddress, normalize) {
  return (address || formAddress) && (address ? normalize([address, bairro].filter(Boolean).join(' - ')) : formAddress);
}

export function mapCnpjToForm(d, form, normalize) {
  const address = [d.logradouro, d.numero, d.complemento].filter(Boolean).join(', ');
  return {
    ...form,
    name: normalize((d.nome_fantasia || '').trim() || (d.razao_social || '').trim()),
    email: d.email || form.email,
    phone: fmtPhone(d.ddd_telefone_1) || form.phone,
    address: montarEnderecoCnpj(address, d.bairro, form.address, normalize),
    cep: d.cep ? d.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2') : form.cep,
    city: d.municipio ? normalize(d.municipio) : form.city,
    state: d.uf || form.state,
  };
}

export function mapCepToForm(d, form, normalize) {
  return {
    ...form,
    address: form.address ? form.address : normalize([d.street, d.neighborhood].filter(Boolean).join(' - ')),
    city: d.city ? normalize(d.city) : form.city,
    state: d.state || form.state,
  };
}
