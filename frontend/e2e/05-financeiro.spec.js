import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const despesa = {
  descricao: 'Despesa E2E Playwright',
  valor: 125,
  saldoInicial: 1000,
  saldoFinal: 875,
};

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(usuariosE2E.admin.email);
  await page.locator('input[type="password"]').fill(usuariosE2E.admin.password);
  const loginPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/auth/login'
  ));
  await page.getByRole('button', { name: 'Entrar' }).click();
  expect((await loginPromise).ok()).toBeTruthy();
  await expect(page).toHaveURL('/');
}

async function selectSearchable(scope, name, option) {
  const combobox = scope.getByRole('combobox', { name, exact: true });
  await combobox.focus();
  await combobox.press('Enter');
  await scope.getByRole('option', { name: option, exact: true }).click();
}

async function openAccounts(page) {
  const accountsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/accounts/'
  ));
  await page.goto('/accounts');
  const response = await accountsPromise;
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function expectAccountBalance(page, accounts, expected) {
  const backendAccount = accounts.find(account => account.name === dadosE2E.conta);
  expect(backendAccount).toBeDefined();
  expect(backendAccount.balance).toBe(expected);
  await expect(page.getByRole('article', { name: `Conta ${dadosE2E.conta}` }))
    .toContainText(`R$ ${expected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

test('cria despesa, registra pagamento e debita o saldo da conta', async ({ page }) => {
  await loginAsAdmin(page);

  const initialAccounts = await openAccounts(page);
  await expectAccountBalance(page, initialAccounts, despesa.saldoInicial);

  const transactionsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/financial/transactions/'
  ));
  await page.goto('/financial');
  expect((await transactionsPromise).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Nova Transação' }).click();

  const modal = page.getByRole('heading', { name: 'Nova Transação' }).locator('..');
  await modal.getByRole('combobox', { name: 'Tipo *' }).selectOption('despesa');
  await modal.getByRole('textbox', { name: 'Descrição' }).fill(despesa.descricao);
  await modal.getByRole('textbox', { name: 'Valor (R$)' }).fill(String(despesa.valor * 100));
  await selectSearchable(modal, 'Categoria', dadosE2E.categoriaFinanceira);
  await selectSearchable(modal, 'Tipo de Pagamento', dadosE2E.tipoPagamento);
  await selectSearchable(modal, 'Conta / Cartão', dadosE2E.conta);

  const createPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/financial/transactions/'
  ));
  const refreshedListPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/financial/transactions/'
  ));
  await modal.getByRole('button', { name: 'Salvar' }).click();
  const createResponse = await createPromise;
  expect(createResponse.ok()).toBeTruthy();
  const transaction = await createResponse.json();
  expect(transaction.type).toBe('despesa');
  expect(transaction.amount).toBe(despesa.valor);
  expect(transaction.status).toBe('pendente');
  expect((await refreshedListPromise).ok()).toBeTruthy();

  const row = page.getByRole('row').filter({ hasText: despesa.descricao });
  await expect(row).toContainText(dadosE2E.categoriaFinanceira);
  await expect(row).toContainText(dadosE2E.tipoPagamento);
  await expect(row).toContainText(dadosE2E.conta);
  await expect(row).toContainText('Despesa');
  await expect(row).toContainText('Pendente');
  await expect(row).toContainText('R$ 125,00');

  await row.getByRole('button', { name: `Baixar ${despesa.descricao}` }).click();
  const paymentModal = page.getByRole('heading', { name: 'Registrar Pagamento' }).locator('..');
  await expect(paymentModal.getByRole('textbox', { name: 'Valor a pagar *' })).toHaveValue('125,00');

  const paymentPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/payments/'
  ));
  const paidListPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/financial/transactions/'
  ));
  await paymentModal.getByRole('button', { name: 'Confirmar Pagamento' }).click();
  const paymentResponse = await paymentPromise;
  expect(paymentResponse.ok()).toBeTruthy();
  expect((await paymentResponse.json()).amount).toBe(despesa.valor);
  expect((await paidListPromise).ok()).toBeTruthy();
  await expect(row).toContainText('Pago');

  const updatedAccounts = await openAccounts(page);
  await expectAccountBalance(page, updatedAccounts, despesa.saldoFinal);

  const persistedAccountsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/accounts/'
  ));
  await page.reload();
  const persistedResponse = await persistedAccountsPromise;
  expect(persistedResponse.ok()).toBeTruthy();
  await expectAccountBalance(page, await persistedResponse.json(), despesa.saldoFinal);
});
