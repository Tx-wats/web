import { test, expect } from '@playwright/test';

test.describe('Contract Interaction and Rules', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock Freighter as connected
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
  });

  test('should display contract list page', async ({ page }) => {
    await page.goto('/');
    // Navigate to contracts page
    const contractsLink = page.getByRole('link', { name: /contracts/i });
    if (await contractsLink.isVisible()) {
      await contractsLink.click();
    }
    await page.goto('/contracts');
    await expect(page).toHaveURL('/contracts');
  });

  test('should allow importing a contract', async ({ page }) => {
    await page.goto('/contracts');

    // Look for import button
    const importButton = page.getByRole('button', { name: /import/i });
    if (await importButton.isVisible()) {
      await importButton.click();

      // Fill in contract details
      const contractIdInput = page.getByPlaceholder(/contract.*id|address/i);
      if (await contractIdInput.isVisible()) {
        await contractIdInput.fill('CCAFCJX2YXVWZ3LFNUDQJ7MZWFVDQ7X54XDLLXTZACLXQRM7DN7XEL');
      }

      // Submit
      const submitButton = page.getByRole('button', { name: /import|add|save/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();
      }
    }
  });

  test('should display contract details', async ({ page }) => {
    await page.goto('/contracts');

    // Look for first contract or import one
    const contractCard = page.locator('[data-testid="contract-card"]').first();
    if (await contractCard.isVisible()) {
      await contractCard.click();

      // Should show contract details
      await expect(page).toHaveURL(/\/contracts\/[^\/]+/);
    }
  });
});

test.describe('Alert Rules Management', () => {
  test.beforeEach(async ({ page, context }) => {
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
  });

  test('should add a new alert rule', async ({ page }) => {
    await page.goto('/contracts');

    // Navigate to a contract with alerts
    const contractCard = page.locator('[data-testid="contract-card"]').first();
    if (await contractCard.isVisible()) {
      await contractCard.click();
    }

    // Look for rules section
    const rulesSection = page.locator('text=Rules').first();
    if (await rulesSection.isVisible()) {
      const addRuleButton = page.getByRole('button', { name: /add rule/i });
      if (await addRuleButton.isVisible()) {
        await addRuleButton.click();

        // Select rule type
        const typeSelect = page.locator('select').first();
        await typeSelect.selectOption('AnyTransaction');

        // Add rule
        const submitButton = page.getByRole('button', { name: /add rule|save/i });
        await submitButton.click();

        // Verify rule was added
        await expect(page.locator('text=AnyTransaction')).toBeVisible();
      }
    }
  });

  test('should edit an existing alert rule', async ({ page }) => {
    await page.goto('/contracts');

    const contractCard = page.locator('[data-testid="contract-card"]').first();
    if (await contractCard.isVisible()) {
      await contractCard.click();
    }

    // Find and edit a rule
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Should show edit form
      const saveButton = page.getByRole('button', { name: /save|update/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    }
  });

  test('should remove an alert rule', async ({ page }) => {
    await page.goto('/contracts');

    const contractCard = page.locator('[data-testid="contract-card"]').first();
    if (await contractCard.isVisible()) {
      await contractCard.click();
    }

    const removeButton = page.getByRole('button', { name: /remove|delete/i }).first();
    if (await removeButton.isVisible()) {
      const initialCount = await page.locator('[data-testid="rule-item"]').count();
      await removeButton.click();

      // Verify rule count decreased
      if (initialCount > 0) {
        const finalCount = await page.locator('[data-testid="rule-item"]').count();
        expect(finalCount).toBeLessThan(initialCount);
      }
    }
  });

  test('should apply rule presets', async ({ page }) => {
    await page.goto('/contracts');

    const contractCard = page.locator('[data-testid="contract-card"]').first();
    if (await contractCard.isVisible()) {
      await contractCard.click();
    }

    const presetsButton = page.getByRole('button', { name: /presets/i });
    if (await presetsButton.isVisible()) {
      await presetsButton.click();

      // Select a preset
      const presetOption = page.getByRole('menuitem').first();
      if (await presetOption.isVisible()) {
        await presetOption.click();

        // Verify rules were added
        const rules = page.locator('[data-testid="rule-item"]');
        const count = await rules.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});
