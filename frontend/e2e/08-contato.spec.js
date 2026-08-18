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

async function openContacts(page) {
  const responsePromise = waitForApi(page, 'GET', '/contacts/');
  await page.goto('/contacts');
  expect((await responsePromise).ok()).toBeTruthy();
}

test('cadastra, edita e remove contato e administra seguimentos', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.route('https://brasilapi.com.br/api/cnpj/v1/12345678000195', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      nome_fantasia: 'Empresa Consultada E2E',
      razao_social: 'Empresa Consultada E2E LTDA',
      email: 'consulta@e2e.test',
      ddd_telefone_1: '85999998888',
      logradouro: 'Rua Teste', numero: '123', bairro: 'Centro',
      cep: '60000000', municipio: 'Fortaleza', uf: 'CE',
    }),
  }));
  await page.route('https://brasilapi.com.br/api/cep/v2/60000000', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ street: 'Avenida E2E', neighborhood: 'Aldeota', city: 'Fortaleza', state: 'CE' }),
  }));

  await loginAsAdmin(page);
  await openContacts(page);

  await page.getByRole('button', { name: 'Seguimentos' }).click();
  const segmentsModal = page.getByRole('heading', { name: 'Seguimentos' }).locator('..').locator('..');
  await segmentsModal.getByPlaceholder('Novo seguimento...').fill('Segmento Fluxo E2E');
  const addSegment = waitForApi(page, 'POST', '/contact-segments/');
  const refreshAfterAdd = waitForApi(page, 'GET', '/contact-segments/');
  await segmentsModal.getByRole('button', { name: 'Adicionar' }).click();
  expect((await addSegment).ok()).toBeTruthy();
  expect((await refreshAfterAdd).ok()).toBeTruthy();
  await expect(segmentsModal.getByText('Segmento Fluxo E2e', { exact: true })).toBeVisible();

  const segmentRow = segmentsModal.getByRole('listitem').first();
  await segmentRow.getByRole('button').nth(0).click();
  await expect(segmentRow.locator('input')).toBeVisible();
  await segmentRow.locator('input').fill('Segmento Fluxo E2E Renomeado');
  const renameSegment = waitForApi(page, 'PUT', '/contact-segments/');
  const refreshAfterRename = waitForApi(page, 'GET', '/contact-segments/');
  await segmentRow.getByRole('button').nth(0).click();
  expect((await renameSegment).ok()).toBeTruthy();
  expect((await refreshAfterRename).ok()).toBeTruthy();
  await expect(segmentsModal.getByText('Segmento Fluxo E2e Renomeado', { exact: true })).toBeVisible();

  const renamedRow = segmentsModal.getByRole('listitem').first();
  const deleteSegment = waitForApi(page, 'DELETE', '/contact-segments/');
  const refreshAfterDelete = waitForApi(page, 'GET', '/contact-segments/');
  await renamedRow.getByRole('button').nth(1).click();
  expect((await deleteSegment).ok()).toBeTruthy();
  expect((await refreshAfterDelete).ok()).toBeTruthy();
  await expect(segmentsModal.getByText('Segmento Fluxo E2e Renomeado', { exact: true })).toHaveCount(0);
  await segmentsModal.getByRole('button').first().click();

  await page.getByRole('button', { name: 'Novo Contato' }).click();
  const createModal = page.getByRole('heading', { name: 'Novo Contato' }).locator('..');
  await createModal.getByPlaceholder('CPF/CNPJ').fill('12.345.678/0001-95');
  await createModal.getByTitle('Buscar dados pelo CNPJ').click();
  await expect(createModal.getByPlaceholder('Nome *')).toHaveValue('Empresa Consultada E2e');
  await expect(createModal.getByPlaceholder('Cidade')).toHaveValue('Fortaleza');
  await createModal.getByPlaceholder('CEP').fill('60000-000');
  await createModal.getByPlaceholder('Endereço').fill('');
  await createModal.getByTitle('Buscar endereço pelo CEP').click();
  await expect(createModal.getByPlaceholder('Endereço')).toHaveValue('Avenida E2e - Aldeota');
  await createModal.getByPlaceholder('Nome *').fill('Contato E2E');
  await createModal.getByPlaceholder('Email').fill('contato@e2e.test');
  const createContact = waitForApi(page, 'POST', '/contacts/');
  await createModal.getByRole('button', { name: 'Salvar' }).click();
  expect((await createContact).ok()).toBeTruthy();
  await expect(page.getByText('Contato E2e', { exact: true })).toBeVisible();

  const contactCard = page.locator('div.bg-white.rounded-xl').filter({ hasText: 'Contato E2e' });
  await contactCard.getByRole('button', { name: 'Editar Contato E2e' }).click();
  const editModal = page.getByRole('heading', { name: 'Editar Contato' }).locator('..');
  await editModal.getByPlaceholder('Nome *').fill('Contato E2E Editado');
  const updateContact = waitForApi(page, 'PUT', '/contacts/');
  await editModal.getByRole('button', { name: 'Salvar' }).click();
  expect((await updateContact).ok()).toBeTruthy();
  await expect(page.getByText('Contato E2e Editado', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Contato E2e Editado', { exact: true })).toBeVisible();
  const editedCard = page.locator('div.bg-white.rounded-xl').filter({ hasText: 'Contato E2e Editado' });
  const deleteContact = waitForApi(page, 'DELETE', '/contacts/');
  await editedCard.getByRole('button', { name: 'Excluir Contato E2e Editado' }).click();
  expect((await deleteContact).ok()).toBeTruthy();
  await expect(page.getByText('Contato E2e Editado', { exact: true })).toHaveCount(0);
});
