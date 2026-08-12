export const usuariosE2E = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@e2e.test',
    password: process.env.E2E_ADMIN_PASSWORD || 'admin-e2e',
  },
  comum: {
    email: process.env.E2E_USER_EMAIL || 'usuario@e2e.test',
    password: process.env.E2E_USER_PASSWORD || 'usuario-e2e',
  },
};

export const dadosE2E = {
  depositos: ['Depósito Central E2E', 'Depósito Filial E2E'],
  unidade: 'Unidade E2E',
  categoria: 'Categoria E2E',
  produtos: ['Arroz E2E', 'Feijão E2E', 'Café E2E'],
  conta: 'Conta E2E',
  tipoPagamento: 'Dinheiro E2E',
  contato: 'Cliente E2E',
};
