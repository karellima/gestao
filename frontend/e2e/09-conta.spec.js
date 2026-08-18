import { test, expect } from '@playwright/test';

import { usuariosE2E } from './fixtures/dados.js';

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(usuariosE2E.admin.email);
  await page.locator('input[type="password"]').fill(usuariosE2E.admin.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}

function waitForApi(page, method, pathname) {
  return page.waitForResponse(response => (
    response.request().method() === method
    && new URL(response.url()).pathname.startsWith(`/api${pathname}`)
  ));
}

async function openAccounts(page) {
  const responsePromise = waitForApi(page, 'GET', '/accounts/');
  await page.goto('/accounts');
  expect((await responsePromise).ok()).toBeTruthy();
}

async function createBankAccount(page) {
  await page.getByRole('button', { name: 'Nova Conta' }).click();
  const modal = page.getByRole('heading', { name: 'Nova Conta' }).locator('..').locator('..');
  await modal.getByPlaceholder('Ex: Itaú Corrente, Nubank...').fill('Banco E2E');
  await modal.getByPlaceholder('Ex: Itaú, Bradesco, BB...').fill('Banco E2E');
  await modal.getByPlaceholder('Ex: 0001').fill('0001');
  await modal.getByPlaceholder('Ex: 12345-6').fill('12345-6');
  const responsePromise = waitForApi(page, 'POST', '/accounts/');
  await modal.getByRole('button', { name: 'Criar Conta' }).click();
  expect((await responsePromise).ok()).toBeTruthy();
}

async function createCreditCard(page) {
  await page.getByRole('button', { name: 'Nova Conta' }).click();
  const modal = page.getByRole('heading', { name: 'Nova Conta' }).locator('..').locator('..');
  const type = modal.locator('select').first();
  await type.selectOption('cartao_credito');
  await expect(modal.getByText('Dados do Cartão', { exact: true })).toBeVisible();
  await modal.getByPlaceholder('Ex: Itaú Corrente, Nubank...').fill('Cartão E2E');
  await modal.getByPlaceholder('Ex: Itaú, Bradesco, BB...').fill('Banco Cartão E2E');
  await modal.getByPlaceholder('Ex: 1234').fill('4321');
  const cardFields = modal.locator('select');
  await cardFields.nth(1).selectOption('Visa');
  const cardInput = label => modal.locator('label').filter({ hasText: label }).locator('..').locator('input');
  await cardInput('Fechamento').fill('10');
  await cardInput('Vencimento').fill('20');
  await cardInput('Melhor Dia').fill('1');
  await cardInput('Limite Disponível').fill('500000');
  const responsePromise = waitForApi(page, 'POST', '/accounts/');
  await modal.getByRole('button', { name: 'Criar Conta' }).click();
  expect((await responsePromise).ok()).toBeTruthy();
}

test('faz CRUD de banco e cartão e filtra contas por tipo', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await loginAsAdmin(page);
  await openAccounts(page);
  await createBankAccount(page);
  await expect(page.getByRole('article', { name: 'Conta Banco E2E' })).toContainText('Banco');

  await createCreditCard(page);
  const card = page.getByRole('article', { name: 'Conta Cartão E2E' });
  await expect(card).toContainText('Cartão de Crédito');
  await expect(card).toContainText('Visa');
  await expect(card).toContainText('Dia 10');
  await expect(card).toContainText('Dia 20');
  await expect(card).toContainText('R$ 5.000,00');
  await expect(page.getByText('Dados do Cartão', { exact: true })).toHaveCount(0);

  const bank = page.getByRole('article', { name: 'Conta Banco E2E' });
  await bank.getByRole('button', { name: 'Editar Banco E2E' }).click();
  const editModal = page.getByRole('heading', { name: 'Editar Conta' }).locator('..').locator('..');
  await editModal.getByPlaceholder('Ex: Itaú Corrente, Nubank...').fill('Banco E2E Editado');
  const update = waitForApi(page, 'PUT', '/accounts/');
  await editModal.getByRole('button', { name: 'Atualizar' }).click();
  expect((await update).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('article', { name: 'Conta Banco E2E Editado' })).toBeVisible();

  await page.getByRole('button', { name: 'Bancos' }).click();
  await expect(page.getByRole('article', { name: 'Conta Banco E2E Editado' })).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Conta Cartão E2E' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cartões' }).click();
  await expect(page.getByRole('article', { name: 'Conta Cartão E2E' })).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Conta Banco E2E Editado' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Todas' }).click();

  const deleteBank = waitForApi(page, 'DELETE', '/accounts/');
  await page.getByRole('article', { name: 'Conta Banco E2E Editado' })
    .getByRole('button', { name: 'Excluir Banco E2E Editado' }).click();
  expect((await deleteBank).ok()).toBeTruthy();
  const deleteCard = waitForApi(page, 'DELETE', '/accounts/');
  await page.getByRole('article', { name: 'Conta Cartão E2E' })
    .getByRole('button', { name: 'Excluir Cartão E2E' }).click();
  expect((await deleteCard).ok()).toBeTruthy();
  await expect(page.getByRole('article', { name: 'Conta Banco E2E Editado' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Conta Cartão E2E' })).toHaveCount(0);
});
