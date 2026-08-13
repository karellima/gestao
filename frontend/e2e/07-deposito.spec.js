import { test, expect } from '@playwright/test';

import { dadosE2E, usuariosE2E } from './fixtures/dados.js';

const fluxo = {
  produto: dadosE2E.produtos[0],
  subDeposito: 'Sub-depósito E2E',
  quantidadeTransferencia: 1,
  quantidadeAvaria: 1,
  descricaoAvaria: 'Avaria E2E 0.11',
  motivoPreparacao: 'Preparação E2E 0.11',
  motivoLimpeza: 'Limpeza E2E 0.11',
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

function waitForApi(page, method, path) {
  const requestPathname = new URL(path, 'http://e2e.local').pathname;
  const pathname = requestPathname.startsWith('/api') ? requestPathname : `/api${requestPathname}`;
  return page.waitForResponse(response => (
    response.request().method() === method
    && new URL(response.url()).pathname === pathname
  ));
}

async function getApiJson(page, path) {
  const responsePromise = waitForApi(page, 'GET', path);
  const bodyPromise = page.evaluate(async requestPath => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api${requestPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: response.ok, data: await response.json() };
  }, path);
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await bodyPromise;
  expect(body.ok).toBeTruthy();
  return body.data;
}

async function postApiJson(page, path, data) {
  const responsePromise = waitForApi(page, 'POST', path);
  const bodyPromise = page.evaluate(async ({ requestPath, requestBody }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api${requestPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    return { ok: response.ok, data: await response.json() };
  }, { requestPath: path, requestBody: data });
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await bodyPromise;
  expect(body.ok).toBeTruthy();
  return body.data;
}

async function readBalance(page, depositId, productId) {
  const data = await getApiJson(page, `/stock/balance/?deposit_id=${depositId}`);
  return data.find(item => item.product_id === productId)?.balance || 0;
}

async function readMovements(page, depositId) {
  return getApiJson(page, `/stock/movements/?deposit_id=${depositId}`);
}

// Nunca leia o corpo de uma resposta produzida por uma navegação: o Chromium
// descarta esse corpo quando a navegação termina, e `response.json()` falha sem
// existir erro de HTTP. Da resposta da navegação só se confere o `.ok()`; o dado
// vem do `getApiJson`, que faz um fetch próprio de dentro da página.
async function openDeposits(page) {
  const depositsPromise = waitForApi(page, 'GET', '/api/deposits/mine');
  const productsPromise = waitForApi(page, 'GET', '/api/products/');
  await page.goto('/deposits');
  expect((await depositsPromise).ok()).toBeTruthy();
  expect((await productsPromise).ok()).toBeTruthy();
  return {
    deposits: await getApiJson(page, '/deposits/mine'),
    products: await getApiJson(page, '/products/'),
  };
}

function depositCard(page, deposit) {
  return page.locator('div.bg-white.rounded-xl')
    .filter({ hasText: deposit.name })
    .filter({ has: page.getByRole('button', { name: 'Saldo', exact: true }) })
    .first();
}

async function ensureChildDeposit(page, parent, deposits) {
  const existing = deposits.find(deposit => (
    deposit.parent_id === parent.id && deposit.name === fluxo.subDeposito
  ));
  if (existing) return existing;

  await depositCard(page, parent).getByRole('button', { name: 'Sub-depósito', exact: true }).click();
  const modal = page.getByRole('heading', { name: 'Novo Sub-depósito' }).locator('..');
  await modal.getByPlaceholder('Nome *').fill(fluxo.subDeposito);

  const createPromise = waitForApi(page, 'POST', '/api/deposits/');
  const refreshedListPromise = waitForApi(page, 'GET', '/api/deposits/mine');
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click();
  const createResponse = await createPromise;
  expect(createResponse.ok()).toBeTruthy();
  const child = await createResponse.json();
  expect((await refreshedListPromise).ok()).toBeTruthy();
  return child;
}

async function selectProduct(modal, product) {
  await modal.getByPlaceholder('Buscar produto...').fill(product.name);
  await modal.getByRole('button', { name: new RegExp(product.name) }).click();
}

async function transferThroughModal(page, type, child, product, quantity) {
  const buttonName = type === 'abastecimento' ? 'Abastecer' : 'Devolver';
  const modalTitle = type === 'abastecimento' ? 'Abastecimento' : 'Devolução';
  await depositCard(page, child).getByRole('button', { name: buttonName, exact: true }).click();
  const modal = page.getByRole('heading', { name: modalTitle }).locator('..').locator('..').locator('..');
  await selectProduct(modal, product);
  await modal.getByRole('spinbutton').fill(String(quantity));

  const transferPromise = waitForApi(page, 'POST', '/api/stock/transfer');
  await modal.getByRole('button', { name: `Realizar ${modalTitle}` }).click();
  const response = await transferPromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: modalTitle })).toHaveCount(0);
}

async function registerAvariaThroughModal(page, parent, product, quantity) {
  await depositCard(page, parent).getByRole('button', { name: 'Avaria', exact: true }).click();
  const modal = page.getByRole('heading', { name: 'Registrar Avaria' }).locator('..').locator('..').locator('..');
  await modal.getByPlaceholder('Ex: Produto danificado, vencido, quebrado...').fill(fluxo.descricaoAvaria);
  await selectProduct(modal, product);
  await modal.getByRole('spinbutton').fill(String(quantity));

  const avariaPromise = waitForApi(page, 'POST', '/api/stock/avaria');
  await modal.getByRole('button', { name: 'Registrar Avaria', exact: true }).click();
  const response = await avariaPromise;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Registrar Avaria' })).toHaveCount(0);
}

function newMovement(before, after) {
  const beforeIds = new Set(before.map(movement => movement.id));
  const created = after.filter(movement => !beforeIds.has(movement.id));
  expect(created).toHaveLength(1);
  return created[0];
}

async function expectBalanceModal(page, parent, product, expected) {
  const responsePromise = waitForApi(page, 'GET', '/api/stock/balance/');
  await depositCard(page, parent).getByRole('button', { name: 'Saldo', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const modal = page.getByRole('heading', { name: `Saldo - ${parent.name}` })
    .locator('..').locator('..').locator('..');
  const row = modal.getByRole('row').filter({ hasText: `${product.name} ${product.unit.abbreviation}` });
  const displayedBalance = Number((await row.getByRole('cell').nth(3).textContent()).trim());
  expect(displayedBalance).toBe(expected);
  await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
}

async function expectMovementsModal(page, parent, product, expectedMovements) {
  const responsePromise = waitForApi(page, 'GET', '/api/stock/movements/');
  await depositCard(page, parent).getByRole('button', { name: 'Mov.', exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const movements = await response.json();
  const expectedIds = expectedMovements.map(movement => movement.id);
  expect(movements.filter(movement => expectedIds.includes(movement.id)).map(movement => movement.id))
    .toEqual(expectedIds);

  const modal = page.getByRole('heading', { name: `Movimentações - ${parent.name}` })
    .locator('..').locator('..').locator('..');
  const rows = modal.locator('tbody tr');
  const rowTexts = await rows.allTextContents();
  const indexes = expectedMovements.map(movement => rowTexts.findIndex(text => text.includes(movement.reason)));
  expect(indexes.every(index => index >= 0)).toBeTruthy();
  expect(indexes[0]).toBeLessThan(indexes[1]);
  expect(indexes[1]).toBeLessThan(indexes[2]);
  for (const movement of expectedMovements) {
    const row = modal.getByRole('row').filter({ hasText: movement.reason });
    await expect(row).toContainText(product.name);
    await expect(row.getByRole('cell').nth(3)).toHaveText(String(movement.quantity));
  }
}

test('movimenta estoque entre depósitos e exibe saldo e histórico', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await loginAsAdmin(page);

  let parent;
  let child;
  let product;
  let setupQuantity = 0;
  let transferDone = false;
  let returnDone = false;
  let avariaDone = false;

  try {
    const { deposits, products } = await openDeposits(page);
    parent = deposits.find(deposit => deposit.name === dadosE2E.depositos[0]);
    const seedDestination = deposits.find(deposit => deposit.name === dadosE2E.depositos[1]);
    product = products.find(item => item.name === fluxo.produto);
    expect(parent).toBeDefined();
    expect(seedDestination).toBeDefined();
    expect(product).toBeDefined();
    await expect(page.getByText(parent.name, { exact: true })).toBeVisible();
    await expect(page.getByText(seedDestination.name, { exact: true })).toBeVisible();

    child = await ensureChildDeposit(page, parent, deposits);
    await expect(page.locator('div.ml-8').filter({ hasText: child.name })).toBeVisible();

    const originalParentBalance = await readBalance(page, parent.id, product.id);
    const requiredBalance = fluxo.quantidadeTransferencia + fluxo.quantidadeAvaria;
    setupQuantity = Math.max(0, requiredBalance - originalParentBalance);
    if (setupQuantity > 0) {
      await postApiJson(page, '/stock/movements/', {
        product_id: product.id,
        deposit_id: parent.id,
        movement_type: 'entrada',
        quantity: setupQuantity,
        unit_price: 0,
        reason: fluxo.motivoPreparacao,
      });
    }

    const initialParentBalance = await readBalance(page, parent.id, product.id);
    const initialChildBalance = await readBalance(page, child.id, product.id);
    expect(initialParentBalance).toBeGreaterThanOrEqual(requiredBalance);

    const beforeAbastecimentoParent = await readMovements(page, parent.id);
    const beforeAbastecimentoChild = await readMovements(page, child.id);
    await transferThroughModal(page, 'abastecimento', child, product, fluxo.quantidadeTransferencia);
    transferDone = true;
    const abastecimentoParent = newMovement(beforeAbastecimentoParent, await readMovements(page, parent.id));
    const abastecimentoChild = newMovement(beforeAbastecimentoChild, await readMovements(page, child.id));
    expect(abastecimentoParent.movement_type).toBe('saida');
    expect(abastecimentoChild.movement_type).toBe('entrada');
    expect(await readBalance(page, parent.id, product.id))
      .toBe(initialParentBalance - fluxo.quantidadeTransferencia);
    expect(await readBalance(page, child.id, product.id))
      .toBe(initialChildBalance + fluxo.quantidadeTransferencia);

    const beforeDevolucaoParent = await readMovements(page, parent.id);
    const beforeDevolucaoChild = await readMovements(page, child.id);
    await transferThroughModal(page, 'devolucao', child, product, fluxo.quantidadeTransferencia);
    returnDone = true;
    const devolucaoParent = newMovement(beforeDevolucaoParent, await readMovements(page, parent.id));
    const devolucaoChild = newMovement(beforeDevolucaoChild, await readMovements(page, child.id));
    expect(devolucaoParent.movement_type).toBe('entrada');
    expect(devolucaoChild.movement_type).toBe('saida');
    expect(await readBalance(page, parent.id, product.id)).toBe(initialParentBalance);
    expect(await readBalance(page, child.id, product.id)).toBe(initialChildBalance);
    expect(
      (await readBalance(page, parent.id, product.id)) + (await readBalance(page, child.id, product.id)),
    ).toBe(initialParentBalance + initialChildBalance);

    const beforeAvariaParent = await readMovements(page, parent.id);
    await registerAvariaThroughModal(page, parent, product, fluxo.quantidadeAvaria);
    avariaDone = true;
    const avariaParent = newMovement(beforeAvariaParent, await readMovements(page, parent.id));
    expect(avariaParent.movement_type).toBe('saida');
    expect(await readBalance(page, parent.id, product.id))
      .toBe(initialParentBalance - fluxo.quantidadeAvaria);
    expect(await readBalance(page, child.id, product.id)).toBe(initialChildBalance);
    expect(
      (await readBalance(page, parent.id, product.id)) + (await readBalance(page, child.id, product.id)),
    ).toBe(initialParentBalance + initialChildBalance - fluxo.quantidadeAvaria);

    await expectBalanceModal(page, parent, product, initialParentBalance - fluxo.quantidadeAvaria);
    await expectMovementsModal(page, parent, product, [avariaParent, devolucaoParent, abastecimentoParent]);

    expect(abastecimentoChild.reason).toContain('Abastecimento');
    expect(devolucaoChild.reason).toContain('Devolução');
  } finally {
    if (transferDone && !returnDone) {
      await postApiJson(page, '/stock/transfer', {
        source_deposit_id: child.id,
        destination_deposit_id: parent.id,
        transfer_type: 'devolucao',
        items: [{ product_id: product.id, quantity: fluxo.quantidadeTransferencia }],
      });
    }
    if (avariaDone) {
      await postApiJson(page, '/stock/movements/', {
        product_id: product.id,
        deposit_id: parent.id,
        movement_type: 'entrada',
        quantity: fluxo.quantidadeAvaria,
        unit_price: 0,
        reason: fluxo.motivoLimpeza,
      });
    }
    if (setupQuantity > 0) {
      await postApiJson(page, '/stock/movements/', {
        product_id: product.id,
        deposit_id: parent.id,
        movement_type: 'saida',
        quantity: setupQuantity,
        unit_price: 0,
        reason: fluxo.motivoLimpeza,
      });
    }
  }
});
