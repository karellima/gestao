import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const entrada = {
  produto: dadosE2E.produtos[0],
  deposito: dadosE2E.depositos[0],
  quantidade: 7,
  preco: '650',
  motivo: 'Compra E2e',
};

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(usuariosE2E.admin.email);
  await page.locator('input[type="password"]').fill(usuariosE2E.admin.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}

async function selectSearchable(modal, name, option) {
  await modal.getByRole('combobox', { name }).focus();
  await modal.getByRole('combobox', { name }).press('Enter');
  await modal.getByRole('option', { name: option, exact: true }).click();
}

async function consultBalance(page) {
  const responsePromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/balance/'
  ));
  await page.getByRole('button', { name: 'Consultar' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  return response;
}

test('registra entrada e atualiza saldo e histórico do estoque', async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto('/stock-reports');
  await expect(page.getByRole('heading', { name: 'Relatórios de Estoque' })).toBeVisible();
  await page.getByLabel('Depósito').selectOption({ label: entrada.deposito });
  await consultBalance(page);
  await expect(page.getByRole('row').filter({ hasText: entrada.produto })).toHaveCount(0);

  const movementsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  await page.goto('/stock');
  expect((await movementsPromise).ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Nova Entrada' }).click();

  const modal = page.getByRole('heading', { name: 'Nova Entrada de Estoque' }).locator('..');
  await selectSearchable(modal, 'Depósito', entrada.deposito);
  await selectSearchable(modal, 'Produto', `${entrada.produto} un`);
  await modal.getByLabel('Quantidade *').fill(String(entrada.quantidade));
  await modal.getByLabel('Preço Unitário').fill(entrada.preco);
  await modal.getByPlaceholder('Ex: Compra, Devolução, Ajuste').fill(entrada.motivo);

  const createPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  const refreshedHistoryPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/movements/'
  ));
  await modal.getByRole('button', { name: 'Registrar Entrada' }).click();
  expect((await createPromise).ok()).toBeTruthy();
  expect((await refreshedHistoryPromise).ok()).toBeTruthy();

  const movementRow = page.getByRole('row').filter({ hasText: entrada.produto });
  await expect(movementRow).toContainText(entrada.deposito);
  await expect(movementRow).toContainText('Entrada');
  await expect(movementRow.getByRole('cell').nth(4)).toHaveText(String(entrada.quantidade));
  await expect(movementRow).toContainText(entrada.motivo);

  await page.goto('/stock-reports');
  await page.getByLabel('Depósito').selectOption({ label: entrada.deposito });
  await consultBalance(page);
  const balanceRow = page.getByRole('row').filter({ hasText: entrada.produto });
  await expect(balanceRow).toContainText(String(entrada.quantidade));
  await expect(balanceRow.getByRole('cell').nth(3)).toHaveText(String(entrada.quantidade));
});
