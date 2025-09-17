import { test, expect } from '@playwright/test';

test.describe('404 Error Handling', () => {
  test('shows 404 page for non-existent routes', async ({ page }) => {
    // Test various non-existent routes
    const nonExistentRoutes = [
      '/this-page-does-not-exist',
      '/nonexistent',
      '/fake-route',
      '/seller/nonexistent-page',
      '/admin/fake',
      '/products/999999999',
    ];

    for (const route of nonExistentRoutes) {
      await page.goto(route);
      
      // Check that the 404 page is displayed
      await expect(page.getByText('Page Not Found')).toBeVisible();
      await expect(page.getByText(/The page you're looking for doesn't exist/)).toBeVisible();
      
      // Check that there's a way to navigate back
      const homeLink = page.getByRole('link', { name: /go back home|home/i });
      await expect(homeLink).toBeVisible();
      
      // Verify home link works
      await homeLink.click();
      await expect(page.url()).toBe('http://localhost:5000/');
    }
  });

  test('valid routes do not show 404 page', async ({ page }) => {
    // Test that valid routes work correctly
    const validRoutes = [
      '/',
      '/browse',
      '/seller/login',
      '/categories',
    ];

    for (const route of validRoutes) {
      await page.goto(route);
      
      // Should not show 404 page
      await expect(page.getByText('Page Not Found')).not.toBeVisible();
      
      // Should show actual page content
      await expect(page).not.toHaveURL(/.*404.*/);
    }
  });

  test('protected routes redirect to login instead of 404', async ({ page }) => {
    // Test that protected routes redirect to login, not 404
    const protectedRoutes = [
      '/seller/dashboard',
      '/seller/products',
      '/seller/orders',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login API endpoint
      await page.waitForURL(/.*\/api\/login.*/);
      
      // Should not show 404 page
      await expect(page.getByText('Page Not Found')).not.toBeVisible();
    }
  });

  test('navigating to 404 from valid page preserves navigation', async ({ page }) => {
    // Start on a valid page
    await page.goto('/browse');
    await expect(page.getByText('Browse Products')).toBeVisible();
    
    // Navigate to a non-existent route
    await page.goto('/this-does-not-exist');
    await expect(page.getByText('Page Not Found')).toBeVisible();
    
    // Use browser back button
    await page.goBack();
    
    // Should be back on the browse page
    await expect(page.getByText('Browse Products')).toBeVisible();
  });
});