import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const venda = {
  deposito: dadosE2E.depositos[0],
  itens: [
    { produto: dadosE2E.produtos[1], quantidadeInicial: 20, quantidade: 2, preco: 12 },
    { produto: dadosE2E.produtos[2], quantidadeInicial: 20, quantidade: 3, preco: 20 },
  ],
  total: 84,
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
  const combobox = scope.getByRole('combobox', { name });
  await combobox.focus();
  await combobox.press('Enter');
  await scope.getByRole('option', { name: option, exact: true }).click();
}

async function registerStockEntry(page, item) {
  await page.getByRole('button', { name: 'Nova Entrada' }).click();
  const modal = page.getByRole('heading', { name: 'Nova Entrada de Estoque' }).locator('..');
  await selectSearchable(modal, 'Depósito', venda.deposito);
  await selectSearchable(modal, 'Produto', `${item.produto} un`);
  await modal.getByLabel('Quantidade *').fill(String(item.quantidadeInicial));
  await modal.getByLabel('Preço Unitário').fill(String(item.preco * 100));
  await modal.getByPlaceholder('Ex: Compra, Devolução, Ajuste').fill('Estoque para venda E2e');

  const createPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  const historyPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  await modal.getByRole('button', { name: 'Registrar Entrada' }).click();
  expect((await createPromise).ok()).toBeTruthy();
  expect((await historyPromise).ok()).toBeTruthy();
}

async function consultBalance(page) {
  const responsePromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/balance/'
  ));
  await page.getByRole('button', { name: 'Consultar' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

async function expectBalance(page, product, expected) {
  const row = page.getByRole('row').filter({ hasText: product });
  await expect(row.getByRole('cell').nth(3)).toHaveText(String(expected));
}

async function openBalance(page) {
  await page.goto('/stock-reports');
  await page.getByLabel('Depósito').selectOption({ label: venda.deposito });
  await consultBalance(page);
}

async function addSaleItem(page, item) {
  await page.getByRole('button', { name: 'Adicionar Produto' }).click();
  await page.getByPlaceholder('Buscar produto por nome ou SKU...').fill(item.produto);
  await page.getByRole('button', { name: new RegExp(item.produto) }).click();
  await page.getByRole('spinbutton', { name: `Quantidade de ${item.produto} un` })
    .fill(String(item.quantidade));
}

test('cria venda com dois itens, total correto e baixa de estoque', async ({ page }) => {
  await loginAsAdmin(page);

  const initialHistoryPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  await page.goto('/stock');
  expect((await initialHistoryPromise).ok()).toBeTruthy();
  for (const item of venda.itens) await registerStockEntry(page, item);

  await openBalance(page);
  for (const item of venda.itens) {
    await expectBalance(page, item.produto, item.quantidadeInicial);
  }

  await page.goto('/sales/new');
  await expect(page.getByRole('heading', { name: 'Novo Lançamento' })).toBeVisible();
  await selectSearchable(page, 'Cliente', dadosE2E.contato);
  await selectSearchable(page, 'Tipo de Lançamento', dadosE2E.tipoVenda);
  for (const item of venda.itens) await addSaleItem(page, item);
  await expect(page.getByText(`R$ ${venda.total.toFixed(2)}`, { exact: true })).toBeVisible();

  const createPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/sales/'
  ));
  const listPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/sales/'
  ));
  await page.getByRole('button', { name: 'Salvar Lançamento' }).click();
  const createResponse = await createPromise;
  expect(createResponse.ok()).toBeTruthy();
  const createdSale = await createResponse.json();
  expect(createdSale.total_amount).toBe(venda.total);
  expect(createdSale.items).toHaveLength(2);
  expect((await listPromise).ok()).toBeTruthy();

  const saleRow = page.getByRole('row').filter({ hasText: dadosE2E.contato });
  await expect(saleRow).toContainText(dadosE2E.tipoVenda);
  await expect(saleRow).toContainText(`R$ ${venda.total.toFixed(2)}`);
  await expect(saleRow).toContainText('aberto');

  const persistedListPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/sales/'
  ));
  await page.reload();
  expect((await persistedListPromise).ok()).toBeTruthy();
  await expect(page.getByRole('row').filter({ hasText: dadosE2E.contato }))
    .toContainText(`R$ ${venda.total.toFixed(2)}`);

  await openBalance(page);
  for (const item of venda.itens) {
    await expectBalance(page, item.produto, item.quantidadeInicial - item.quantidade);
  }
});
