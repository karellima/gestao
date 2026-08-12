import { test, expect } from '@playwright/test';

import { usuariosE2E } from './fixtures/dados.js';

const adminMenuPaths = [
  '/contacts',
  '/deposits',
  '/products',
  '/stock-reports',
  '/requisicoes',
  '/pricing',
  '/categories',
  '/units',
  '/stock',
  '/accounts',
  '/financial',
  '/financial-categories',
  '/payment-types',
  '/recurrence-frequencies',
  '/financial-reports',
  '/price-tables',
  '/sale-types',
  '/sales',
  '/',
  '/users',
  '/roles',
  '/settings',
];

async function login(page, credentials) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function openNavigation(page) {
  await page.getByTitle('Expandir menu').click();
  return page.locator('aside');
}

test('admin entra e vê o menu completo', async ({ page }) => {
  await login(page, usuariosE2E.admin);
  await expect(page).toHaveURL('/');

  const sidebar = await openNavigation(page);
  const navigation = sidebar.getByRole('navigation');
  await expect(sidebar.getByText('Administrador E2E', { exact: true })).toBeVisible();
  await expect(navigation.locator('a')).toHaveCount(adminMenuPaths.length);
  for (const path of adminMenuPaths) {
    await expect(navigation.locator(`a[href="${path}"]`)).toBeVisible();
  }
});

test('usuário comum entra sem ver itens de administração', async ({ page }) => {
  await login(page, usuariosE2E.comum);
  await expect(page).toHaveURL('/');

  const sidebar = await openNavigation(page);
  const navigation = sidebar.getByRole('navigation');
  await expect(sidebar.getByText('Usuário E2E', { exact: true })).toBeVisible();
  await expect(navigation.locator('a[href="/products"]')).toBeVisible();
  await expect(navigation.locator('a[href="/users"]')).toHaveCount(0);
  await expect(navigation.locator('a[href="/roles"]')).toHaveCount(0);
  await expect(navigation.locator('a[href="/settings"]')).toHaveCount(0);
});

test('senha errada não entra', async ({ page }) => {
  await login(page, { ...usuariosE2E.admin, password: 'senha-incorreta' });

  await expect(page).toHaveURL('/login');
  await expect(page.getByText('Email ou senha inválidos', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
