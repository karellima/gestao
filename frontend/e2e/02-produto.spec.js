import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const produto = {
  nome: 'Produto Cadastro E2e',
  nomeEditado: 'Produto Cadastro Editado E2e',
  sku: 'E2e-cad-001',
};

async function loginAsAdmin(page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(usuariosE2E.admin.email);
  await page.locator('input[type="password"]').fill(usuariosE2E.admin.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/');
}

async function selectOption(field, option) {
  await field.getByText('Selecione...', { exact: true }).click();
  await field.getByText(option, { exact: true }).click();
}

async function saveProduct(page, modal, method) {
  const responsePromise = page.waitForResponse(response => (
    response.request().method() === method
    && new URL(response.url()).pathname.startsWith('/api/products/')
  ));
  await modal.getByRole('button', { name: 'Salvar' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

async function searchProduct(page, name) {
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/api/products/'
      && url.searchParams.get('search') === name;
  });
  await page.getByPlaceholder('Buscar produto...').fill(name);
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

test('cadastra e edita um produto com unidade e categoria', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo Produto' }).click();
  const createModal = page.getByRole('heading', { name: 'Novo Produto' }).locator('..');
  await createModal.getByPlaceholder('Nome do produto *').fill(produto.nome);
  await createModal.getByPlaceholder('SKU *').fill(produto.sku);
  await selectOption(
    createModal.getByText('Categoria', { exact: true }).locator('..'),
    dadosE2E.categoria,
  );
  await selectOption(
    createModal.getByText('Unidade de Medida', { exact: true }).locator('..'),
    `${dadosE2E.unidade} (un)`,
  );
  await saveProduct(page, createModal, 'POST');

  await searchProduct(page, produto.nome);
  const createdRow = page.getByRole('row').filter({ hasText: produto.sku });
  await expect(createdRow).toContainText(`${produto.nome} un`);
  await expect(createdRow).toContainText(dadosE2E.categoria);

  await createdRow.getByRole('button').first().click();
  const editModal = page.getByRole('heading', { name: 'Editar Produto' }).locator('..');
  await editModal.getByPlaceholder('Nome do produto *').fill(produto.nomeEditado);
  await saveProduct(page, editModal, 'PUT');
  await searchProduct(page, produto.nomeEditado);
  const editedRow = page.getByRole('row').filter({ hasText: produto.sku });
  await expect(editedRow).toContainText(`${produto.nomeEditado} un`);

  await page.reload();
  await searchProduct(page, produto.nomeEditado);
  const persistedRow = page.getByRole('row').filter({ hasText: produto.sku });
  await expect(persistedRow).toContainText(`${produto.nomeEditado} un`);
  await expect(persistedRow).toContainText(dadosE2E.categoria);
});
