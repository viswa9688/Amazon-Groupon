import { test, expect } from '@playwright/test';

test.describe('Add to Cart Flow', () => {
  test.describe('Unauthenticated User Flow', () => {
    test('prompts for authentication when adding item to cart', async ({ page }) => {
      // Go to browse page
      await page.goto('/browse');
      await expect(page.getByText('Browse Products')).toBeVisible();

      // Find a product card and click add to cart
      const addToCartButton = page.getByTestId(/button-add-to-cart-/).first();
      await expect(addToCartButton).toBeVisible();
      await addToCartButton.click();

      // Should open phone authentication modal
      await expect(page.getByText('Sign In with Phone')).toBeVisible();
      await expect(page.getByLabelText(/phone number/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /send.*code/i })).toBeVisible();
    });

    test('allows closing authentication modal', async ({ page }) => {
      await page.goto('/browse');
      
      // Click add to cart to open auth modal
      const addToCartButton = page.getByTestId(/button-add-to-cart-/).first();
      await addToCartButton.click();
      
      // Modal should be open
      await expect(page.getByText('Sign In with Phone')).toBeVisible();
      
      // Close the modal
      const closeButton = page.getByRole('button', { name: /close/i });
      await closeButton.click();
      
      // Modal should be closed
      await expect(page.getByText('Sign In with Phone')).not.toBeVisible();
      
      // Should still be on browse page
      await expect(page.getByText('Browse Products')).toBeVisible();
    });

    test('authentication modal preserves page context', async ({ page }) => {
      // Go to a specific product category
      await page.goto('/browse?category=groceries');
      
      // Verify we're on the filtered page
      await expect(page.url()).toContain('category=groceries');
      
      // Click add to cart
      const addToCartButton = page.getByTestId(/button-add-to-cart-/).first();
      await addToCartButton.click();
      
      // Authentication modal opens
      await expect(page.getByText('Sign In with Phone')).toBeVisible();
      
      // Close modal
      await page.getByRole('button', { name: /close/i }).click();
      
      // Should still be on the same filtered page
      await expect(page.url()).toContain('category=groceries');
    });
  });

  test.describe('Product Card Interactions', () => {
    test('add to cart button is visible on all product cards', async ({ page }) => {
      await page.goto('/browse');
      
      // Wait for products to load
      await page.waitForSelector('[data-testid^="button-add-to-cart-"]');
      
      // Check that all product cards have add to cart buttons
      const productCards = page.locator('[data-testid^="card-product-"]');
      const addToCartButtons = page.locator('[data-testid^="button-add-to-cart-"]');
      
      const cardCount = await productCards.count();
      const buttonCount = await addToCartButtons.count();
      
      expect(cardCount).toBeGreaterThan(0);
      expect(buttonCount).toBe(cardCount);
    });

    test('add to cart buttons have appropriate text', async ({ page }) => {
      await page.goto('/browse');
      
      // Wait for products to load
      await page.waitForSelector('[data-testid^="button-add-to-cart-"]');
      
      const addToCartButtons = page.locator('[data-testid^="button-add-to-cart-"]');
      const buttonCount = await addToCartButtons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = addToCartButtons.nth(i);
        const buttonText = await button.textContent();
        
        // Should have either "Add to Cart" or "Book Service" text
        expect(buttonText).toMatch(/(Add to Cart|Book Service)/);
      }
    });

    test('clicking product card navigates to product details', async ({ page }) => {
      await page.goto('/browse');
      
      // Wait for products to load
      await page.waitForSelector('[data-testid^="card-product-"]');
      
      // Click on the first product card (but not the add to cart button)
      const firstProductCard = page.locator('[data-testid^="card-product-"]').first();
      await firstProductCard.click();
      
      // Should navigate to product details page
      await expect(page.url()).toMatch(/\/product\/\d+/);
      
      // Should show product details
      await expect(page.getByRole('heading')).toBeVisible();
    });
  });

  test.describe('Product Details Page', () => {
    test('add to cart from product details opens auth modal', async ({ page }) => {
      // Navigate to a specific product
      await page.goto('/browse');
      await page.waitForSelector('[data-testid^="card-product-"]');
      
      // Click on first product to go to details
      await page.locator('[data-testid^="card-product-"]').first().click();
      await expect(page.url()).toMatch(/\/product\/\d+/);
      
      // Find and click add to cart button on details page
      const addToCartButton = page.getByTestId(/button-add-to-cart/);
      await addToCartButton.click();
      
      // Should open authentication modal
      await expect(page.getByText('Sign In with Phone')).toBeVisible();
    });

    test('product details page shows all necessary information', async ({ page }) => {
      await page.goto('/browse');
      await page.waitForSelector('[data-testid^="card-product-"]');
      
      // Go to product details
      await page.locator('[data-testid^="card-product-"]').first().click();
      
      // Should show product information
      await expect(page.getByRole('heading')).toBeVisible();
      await expect(page.getByText(/\$/)).toBeVisible(); // Price
      await expect(page.getByTestId(/button-add-to-cart/)).toBeVisible();
      
      // Should show seller information
      await expect(page.getByText(/sold by|service by/i)).toBeVisible();
    });
  });

  test.describe('Category Filtering', () => {
    test('category filter preserves add to cart functionality', async ({ page }) => {
      await page.goto('/browse');
      
      // Click on a category filter (if available)
      const categoryFilter = page.getByRole('button', { name: /groceries|services/i }).first();
      if (await categoryFilter.isVisible()) {
        await categoryFilter.click();
        
        // Wait for filtered results
        await page.waitForTimeout(500);
        
        // Try adding to cart from filtered results
        const addToCartButton = page.getByTestId(/button-add-to-cart-/).first();
        if (await addToCartButton.isVisible()) {
          await addToCartButton.click();
          
          // Should still open auth modal
          await expect(page.getByText('Sign In with Phone')).toBeVisible();
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('handles network errors gracefully', async ({ page }) => {
      await page.goto('/browse');
      
      // Simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      // Try to add to cart
      const addToCartButton = page.getByTestId(/button-add-to-cart-/).first();
      await addToCartButton.click();
      
      // Should still show auth modal (since auth check happens client-side first)
      await expect(page.getByText('Sign In with Phone')).toBeVisible();
    });

    test('handles empty product list gracefully', async ({ page }) => {
      // Go to browse page
      await page.goto('/browse');
      
      // If there are no products, should show appropriate message
      const productCards = page.locator('[data-testid^="card-product-"]');
      const cardCount = await productCards.count();
      
      if (cardCount === 0) {
        // Should show "no products" message or similar
        await expect(page.getByText(/no products|coming soon/i)).toBeVisible();
      } else {
        // If there are products, add to cart should work
        await expect(productCards.first()).toBeVisible();
      }
    });
  });
});