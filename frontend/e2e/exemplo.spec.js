import { test, expect } from '@playwright/test';

test('exibe o campo de e-mail na tela de login', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('input[type="email"]')).toBeVisible();
});
