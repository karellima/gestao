import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const requisicao = {
  produto: dadosE2E.produtos[0],
  quantidade: 5,
  motivo: 'Reposição E2E entre depósitos',
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

async function selectSearchable(scope, product) {
  await scope.getByPlaceholder('Buscar produto...').fill(product);
  await scope.getByRole('button', { name: new RegExp(product) }).click();
}

function waitForRequisicoes(page) {
  return page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/requisicoes/'
  ));
}

function waitForRequisicaoAction(page, action) {
  return page.waitForResponse(response => (
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname.endsWith(`/${action}`)
  ));
}

async function readBalance(page, depositId, productId) {
  const balancePromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/balance/'
    && new URL(response.url()).searchParams.get('deposit_id') === String(depositId)
  ));
  const bodyPromise = page.evaluate(async ({ depositId: id }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/stock/balance/?deposit_id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: response.ok, data: await response.json() };
  }, { depositId });
  const response = await balancePromise;
  expect(response.ok()).toBeTruthy();
  const body = await bodyPromise;
  expect(body.ok).toBeTruthy();
  return body.data.find(item => item.product_id === productId)?.balance || 0;
}

test('cria, aprova, atende e recebe uma requisicao entre depositos', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await loginAsAdmin(page);

  const requisicoesPromise = waitForRequisicoes(page);
  const depositsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/deposits/mine'
  ));
  const productsPromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/products/'
  ));
  await page.goto('/requisicoes');
  expect((await requisicoesPromise).ok()).toBeTruthy();
  const depositsResponse = await depositsPromise;
  const productsResponse = await productsPromise;
  expect(depositsResponse.ok()).toBeTruthy();
  expect(productsResponse.ok()).toBeTruthy();
  const deposits = await depositsResponse.json();
  const products = await productsResponse.json();
  const source = deposits.find(deposit => deposit.name === dadosE2E.depositos[0]);
  const destination = deposits.find(deposit => deposit.name === dadosE2E.depositos[1]);
  const product = products.find(item => item.name === requisicao.produto);
  expect(source).toBeDefined();
  expect(destination).toBeDefined();
  expect(product).toBeDefined();

  const initialSourceBalance = await readBalance(page, source.id, product.id);
  const initialDestinationBalance = await readBalance(page, destination.id, product.id);

  await page.getByRole('button', { name: 'Nova Requisição' }).click();
  const creationModal = page.getByRole('heading', { name: 'Nova Requisição' })
    .locator('..').locator('..');
  await creationModal.getByRole('combobox').nth(0).selectOption({ label: destination.name });
  await creationModal.getByRole('combobox').nth(1).selectOption({ label: source.name });
  await selectSearchable(creationModal, requisicao.produto);
  await creationModal.getByRole('spinbutton').fill(String(requisicao.quantidade));
  await creationModal.getByPlaceholder('Ex: Uso interno, Transferência, Cliente').fill(requisicao.motivo);

  const createPromise = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/requisicoes/'
  ));
  const createdListPromise = waitForRequisicoes(page);
  await creationModal.getByRole('button', { name: 'Criar Requisição' }).click();
  const createResponse = await createPromise;
  expect(createResponse.ok()).toBeTruthy();
  const created = await createResponse.json();
  expect(created.status).toBe('pendente');
  expect(created.items[0].quantity_requested).toBe(requisicao.quantidade);
  expect((await createdListPromise).ok()).toBeTruthy();

  const row = page.getByRole('row').filter({
    has: page.getByRole('cell', { name: String(created.id), exact: true }),
  });
  await expect(row).toContainText('Pendente');
  const approvePromise = waitForRequisicaoAction(page, 'approve');
  const approvedListPromise = waitForRequisicoes(page);
  await row.getByTitle('Liberar').click();
  const approveResponse = await approvePromise;
  expect(approveResponse.ok()).toBeTruthy();
  const approved = await approveResponse.json();
  expect(approved.status).toBe('aprovado');
  expect(approved.items[0].quantity_approved).toBe(requisicao.quantidade);
  expect((await approvedListPromise).ok()).toBeTruthy();
  await expect(row).toContainText('Liberada');

  const fulfillBalancePromise = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/stock/balance/'
    && new URL(response.url()).searchParams.get('deposit_id') === String(source.id)
  ));
  await row.getByTitle('Atender (saída)').click();
  expect((await fulfillBalancePromise).ok()).toBeTruthy();
  const fulfillModal = page.getByRole('heading', { name: `Atender Requisição #${created.id}` })
    .locator('..').locator('..');
  await expect(fulfillModal).toBeVisible();
  const fulfillPromise = waitForRequisicaoAction(page, 'fulfill');
  const fulfilledListPromise = waitForRequisicoes(page);
  await fulfillModal.getByRole('button', { name: 'Confirmar Atendimento' }).click();
  const fulfillResponse = await fulfillPromise;
  expect(fulfillResponse.ok()).toBeTruthy();
  const fulfilled = await fulfillResponse.json();
  expect(fulfilled.status).toBe('atendido');
  expect(fulfilled.items[0].quantity_fulfilled).toBe(requisicao.quantidade);
  expect((await fulfilledListPromise).ok()).toBeTruthy();
  await expect(row).toContainText('Atendida');

  expect(await readBalance(page, source.id, product.id)).toBe(initialSourceBalance);
  expect(await readBalance(page, destination.id, product.id)).toBe(initialDestinationBalance);

  await row.getByTitle('Confirmar recebimento (entrada)').click();
  const receiveModal = page.getByRole('heading', { name: `Conferir Recebimento #${created.id}` })
    .locator('..').locator('..');
  await expect(receiveModal).toBeVisible();
  const receivePromise = waitForRequisicaoAction(page, 'receive');
  const receivedListPromise = waitForRequisicoes(page);
  await receiveModal.getByRole('button', { name: 'Confirmar Recebimento' }).click();
  const receiveResponse = await receivePromise;
  expect(receiveResponse.ok()).toBeTruthy();
  const received = await receiveResponse.json();
  expect(received.status).toBe('recebido');
  expect(received.items[0].quantity_received).toBe(requisicao.quantidade);
  expect((await receivedListPromise).ok()).toBeTruthy();
  await expect(row).toContainText('Recebida');

  expect(await readBalance(page, source.id, product.id))
    .toBe(initialSourceBalance - requisicao.quantidade);
  expect(await readBalance(page, destination.id, product.id))
    .toBe(initialDestinationBalance + requisicao.quantidade);
});
