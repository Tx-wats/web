import { test, expect } from '@playwright/test';

test.describe('Freighter Wallet Connection', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock Freighter wallet extension
    await context.addInitScript(() => {
      window.freighter = {
        isConnected: () => Promise.resolve(false),
        getPublicKey: () => Promise.resolve('GBVFLWXWZNMSMLSJT2YHKVJNLM3FBRNJMZ2QZUPMHSWOMWHP2BYSBUE'),
        signTransaction: (xdr: string) =>
          Promise.resolve({
            envelope_xdr: xdr,
            soroban_authorization_entries: [],
          }),
        isAllowed: () => Promise.resolve(true),
      };
    });
  });

  test('should display connect wallet button on home page', async ({ page }) => {
    await page.goto('/');
    const connectButton = page.getByRole('button', { name: /connect.*freighter/i });
    await expect(connectButton).toBeVisible();
  });

  test('should open Freighter connection flow when clicked', async ({ page }) => {
    await page.goto('/');
    const connectButton = page.getByRole('button', { name: /connect.*freighter/i });
    await connectButton.click();

    // After connection, should show wallet status or dashboard
    await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 5000 });
  });

  test('should show network selector after wallet connection', async ({ page }) => {
    await page.goto('/');

    // Simulate wallet connection
    const connectButton = page.getByRole('button', { name: /connect.*freighter/i });
    await connectButton.click();

    // Look for network selector
    const networkSelect = page.locator('select').first();
    await expect(networkSelect).toBeVisible();
  });
});

test.describe('Wallet Persistence', () => {
  test('should persist wallet connection state across page reloads', async ({ page, context }) => {
    await context.addInitScript(() => {
      window.freighter = {
        isConnected: () => Promise.resolve(true),
        getPublicKey: () => Promise.resolve('GBVFLWXWZNMSMLSJT2YHKVJNLM3FBRNJMZ2QZUPMHSWOMWHP2BYSBUE'),
        signTransaction: (xdr: string) =>
          Promise.resolve({
            envelope_xdr: xdr,
            soroban_authorization_entries: [],
          }),
        isAllowed: () => Promise.resolve(true),
      };
    });

    await page.goto('/');
    await page.reload();

    // Should still show wallet as connected (no connect button)
    const connectButton = page.getByRole('button', { name: /connect.*freighter/i });
    await expect(connectButton).not.toBeVisible();
  });
});
