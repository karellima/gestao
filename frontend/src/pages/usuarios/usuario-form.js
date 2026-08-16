export function getEmptyForm(defaultRole = '') {
  return {
    name: '', email: '', password: '', confirmPassword: '', role: defaultRole, deposit_ids: [],
  };
}

export function toPayload(form, editing = false) {
  if (form.password && form.password !== form.confirmPassword) {
    return { ok: false, erro: 'Senha e confirmação não conferem' };
  }

  const data = {
    name: form.name,
    email: form.email,
    role: form.role,
    deposit_ids: form.deposit_ids,
  };
  if (editing) {
    if (form.password) data.password = form.password;
  } else {
    data.password = form.password;
  }
  return { ok: true, data };
}
