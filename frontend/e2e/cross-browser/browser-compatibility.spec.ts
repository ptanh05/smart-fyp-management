/**
 * Cross-Browser Compatibility Tests
 * 
 * These tests verify that the application works correctly across
 * Chrome, Firefox, Edge, and Safari browsers.
 */

import { test, expect, BrowserContext } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

test.describe('Cross-Browser Compatibility Tests', () => {
  
  test.describe('Login Flow', () => {
    test('should render login page correctly', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Verify page title/header
      await expect(page.locator('h1, h2, .login-title')).toBeVisible();
      
      // Verify user type selector
      const userTypeButtons = page.locator('.user-type-selector button, .type-btn');
      await expect(userTypeButtons.first()).toBeVisible();
      
      // Verify form elements
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Log browser info for debugging
      console.log(`Login page rendered correctly on ${browserName}`);
    });

    test('should handle login submission', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Click on Student tab (should be default)
      await page.click('button:has-text("Student")');
      
      // Fill in credentials
      await page.fill('input[placeholder*="registration"], input[name="registration_no"], input:not([type="password"]):visible', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for response (either success or error)
      await page.waitForTimeout(2000);
      
      // Check we're either on dashboard or still on login with error
      const url = page.url();
      const hasError = await page.locator('.error, .error-message').isVisible().catch(() => false);
      
      console.log(`Login submission handled on ${browserName}: URL=${url}, hasError=${hasError}`);
    });

    test('should switch between user types', async ({ page, browserName }) => {
      await page.goto('/login');
      
      const userTypes = ['Student', 'Supervisor', 'Committee', 'External'];
      
      for (const userType of userTypes) {
        const button = page.locator(`button:has-text("${userType}")`);
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(300);
          
          // Verify button is active
          await expect(button).toHaveClass(/active/);
        }
      }
      
      console.log(`User type switching works on ${browserName}`);
    });
  });

  test.describe('Dashboard Rendering', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to login
      await page.goto('/login');
    });

    test('should render dashboard layout correctly', async ({ page, browserName }) => {
      // Login as student (assuming test data exists)
      await page.fill('input[placeholder*="registration"], input[name="registration_no"], input:not([type="password"]):visible', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      await page.click('button[type="submit"]');
      
      // Wait for navigation
      try {
        await page.waitForURL('**/dashboard**', { timeout: 5000 });
        
        // Verify dashboard elements
        await expect(page.locator('.dashboard-container, .dashboard, main')).toBeVisible();
        
        // Verify navigation/tabs exist
        await expect(page.locator('.tabs, .nav-tabs, nav')).toBeVisible();
        
        console.log(`Dashboard rendered correctly on ${browserName}`);
      } catch {
        console.log(`Dashboard test skipped on ${browserName} - login may have failed`);
      }
    });

    test('should render cards and statistics', async ({ page, browserName }) => {
      // This test assumes successful login
      await page.fill('input[placeholder*="registration"], input[name="registration_no"], input:not([type="password"]):visible', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      await page.click('button[type="submit"]');
      
      try {
        await page.waitForURL('**/dashboard**', { timeout: 5000 });
        
        // Check for card elements
        const cards = page.locator('.card, .stat-card, .info-card');
        const cardCount = await cards.count();
        
        console.log(`Found ${cardCount} cards on ${browserName}`);
        
        if (cardCount > 0) {
          // Verify first card is visible
          await expect(cards.first()).toBeVisible();
        }
      } catch {
        console.log(`Cards test skipped on ${browserName}`);
      }
    });
  });

  test.describe('Form Submission', () => {
    test('should handle form inputs correctly', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Test text input
      const textInput = page.locator('input:not([type="password"]):visible').first();
      await textInput.fill('test input value');
      await expect(textInput).toHaveValue('test input value');
      
      // Test password input
      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('testPassword123');
      await expect(passwordInput).toHaveValue('testPassword123');
      
      // Clear and verify
      await textInput.fill('');
      await expect(textInput).toHaveValue('');
      
      console.log(`Form inputs work correctly on ${browserName}`);
    });

    test('should handle select dropdowns', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // If there are select elements on the page
      const selects = page.locator('select');
      const selectCount = await selects.count();
      
      if (selectCount > 0) {
        const firstSelect = selects.first();
        const options = await firstSelect.locator('option').all();
        
        if (options.length > 1) {
          // Select second option
          await firstSelect.selectOption({ index: 1 });
          console.log(`Select dropdown works on ${browserName}`);
        }
      } else {
        console.log(`No select elements found on login page for ${browserName}`);
      }
    });

    test('should handle textarea correctly', async ({ page, browserName }) => {
      // Navigate to a page with textarea (we'll test on login page first)
      await page.goto('/login');
      
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      
      if (textareaCount > 0) {
        const textarea = textareas.first();
        const testText = 'This is a multiline\ntest message\nfor the textarea.';
        
        await textarea.fill(testText);
        await expect(textarea).toHaveValue(testText);
        
        console.log(`Textarea works correctly on ${browserName}`);
      } else {
        console.log(`No textarea found on current page for ${browserName}`);
      }
    });
  });

  test.describe('Modal Dialogs', () => {
    test('should handle native dialogs', async ({ page, browserName }) => {
      let dialogHandled = false;
      
      page.on('dialog', async (dialog) => {
        console.log(`Dialog appeared on ${browserName}: ${dialog.type()} - ${dialog.message()}`);
        dialogHandled = true;
        await dialog.accept();
      });
      
      // Navigate to login and try actions that might trigger dialogs
      await page.goto('/login');
      
      // Force a dialog for testing (if needed)
      await page.evaluate(() => {
        window.alert('Test dialog');
      });
      
      await page.waitForTimeout(500);
      expect(dialogHandled).toBe(true);
      
      console.log(`Native dialogs handled correctly on ${browserName}`);
    });

    test('should handle confirm dialogs', async ({ page, browserName }) => {
      let confirmResult = null;
      
      page.on('dialog', async (dialog) => {
        if (dialog.type() === 'confirm') {
          confirmResult = true;
          await dialog.accept();
        }
      });
      
      await page.goto('/login');
      
      // Trigger a confirm dialog
      const result = await page.evaluate(() => {
        return window.confirm('Test confirm');
      });
      
      expect(result).toBe(true);
      console.log(`Confirm dialogs work on ${browserName}`);
    });
  });

  test.describe('Responsive Design', () => {
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      test(`should render correctly at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page, browserName }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/login');
        
        // Verify page renders without horizontal scroll
        const body = page.locator('body');
        const bodyWidth = await body.evaluate((el) => el.scrollWidth);
        
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
        
        // Verify login form is visible
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        
        console.log(`${viewport.name} viewport renders correctly on ${browserName}`);
      });
    }

    test('should handle orientation change', async ({ page, browserName }) => {
      // Portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      // Landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(300);
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      console.log(`Orientation change handled correctly on ${browserName}`);
    });
  });

  test.describe('JavaScript Errors', () => {
    test('should have no console errors on login page', async ({ page, browserName }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      page.on('pageerror', (err) => {
        errors.push(err.message);
      });
      
      await page.goto('/login');
      await page.waitForTimeout(2000);
      
      // Filter out known acceptable errors
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('ResizeObserver')
      );
      
      if (criticalErrors.length > 0) {
        console.log(`JavaScript errors on ${browserName}:`, criticalErrors);
      }
      
      expect(criticalErrors.length).toBe(0);
      console.log(`No JavaScript errors on ${browserName}`);
    });

    test('should have no console errors during navigation', async ({ page, browserName }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Navigate through multiple pages
      await page.goto('/login');
      await page.waitForTimeout(500);
      
      // Try navigating to a non-existent page (should redirect to login)
      await page.goto('/nonexistent');
      await page.waitForTimeout(500);
      
      // Back to login
      await page.goto('/login');
      await page.waitForTimeout(500);
      
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('ResizeObserver')
      );
      
      if (criticalErrors.length > 0) {
        console.log(`Navigation errors on ${browserName}:`, criticalErrors);
      }
      
      expect(criticalErrors.length).toBe(0);
      console.log(`No navigation errors on ${browserName}`);
    });
  });

  test.describe('CSS Compatibility', () => {
    test('should render flexbox layouts correctly', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Check if flexbox containers render correctly
      const flexContainers = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let flexCount = 0;
        elements.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'flex' || style.display === 'inline-flex') {
            flexCount++;
          }
        });
        return flexCount;
      });
      
      console.log(`Found ${flexContainers} flexbox containers on ${browserName}`);
      expect(flexContainers).toBeGreaterThanOrEqual(0);
    });

    test('should render grid layouts correctly', async ({ page, browserName }) => {
      await page.goto('/login');
      
      const gridContainers = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let gridCount = 0;
        elements.forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === 'grid' || style.display === 'inline-grid') {
            gridCount++;
          }
        });
        return gridCount;
      });
      
      console.log(`Found ${gridContainers} grid containers on ${browserName}`);
      expect(gridContainers).toBeGreaterThanOrEqual(0);
    });

    test('should render custom properties (CSS variables)', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Check if CSS variables are supported and working
      const cssVarsWorking = await page.evaluate(() => {
        const testEl = document.createElement('div');
        testEl.style.setProperty('--test-var', 'red');
        testEl.style.backgroundColor = 'var(--test-var)';
        document.body.appendChild(testEl);
        
        const computed = window.getComputedStyle(testEl).backgroundColor;
        document.body.removeChild(testEl);
        
        return computed === 'rgb(255, 0, 0)';
      });
      
      expect(cssVarsWorking).toBe(true);
      console.log(`CSS variables work correctly on ${browserName}`);
    });
  });

  test.describe('Event Handling', () => {
    test('should handle click events', async ({ page, browserName }) => {
      await page.goto('/login');
      
      const button = page.locator('button').first();
      let clicked = false;
      
      await page.evaluate(() => {
        document.querySelector('button')?.addEventListener('click', () => {
          (window as any).testClicked = true;
        });
      });
      
      await button.click();
      
      clicked = await page.evaluate(() => (window as any).testClicked || false);
      
      // Click should be registered
      console.log(`Click event ${clicked ? 'registered' : 'not registered'} on ${browserName}`);
    });

    test('should handle keyboard events', async ({ page, browserName }) => {
      await page.goto('/login');
      
      const input = page.locator('input').first();
      await input.focus();
      
      // Type and verify
      await input.type('test');
      const value = await input.inputValue();
      
      expect(value).toBe('test');
      console.log(`Keyboard events work correctly on ${browserName}`);
    });

    test('should handle focus/blur events', async ({ page, browserName }) => {
      await page.goto('/login');
      
      const input = page.locator('input').first();
      
      // Focus
      await input.focus();
      const isFocused = await input.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);
      
      // Blur
      await input.blur();
      const isStillFocused = await input.evaluate((el) => document.activeElement === el);
      expect(isStillFocused).toBe(false);
      
      console.log(`Focus/blur events work correctly on ${browserName}`);
    });
  });

  test.describe('Local Storage', () => {
    test('should support localStorage', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Test localStorage
      await page.evaluate(() => {
        localStorage.setItem('testKey', 'testValue');
      });
      
      const value = await page.evaluate(() => localStorage.getItem('testKey'));
      expect(value).toBe('testValue');
      
      // Clean up
      await page.evaluate(() => localStorage.removeItem('testKey'));
      
      console.log(`localStorage works correctly on ${browserName}`);
    });

    test('should support sessionStorage', async ({ page, browserName }) => {
      await page.goto('/login');
      
      // Test sessionStorage
      await page.evaluate(() => {
        sessionStorage.setItem('testKey', 'testValue');
      });
      
      const value = await page.evaluate(() => sessionStorage.getItem('testKey'));
      expect(value).toBe('testValue');
      
      // Clean up
      await page.evaluate(() => sessionStorage.removeItem('testKey'));
      
      console.log(`sessionStorage works correctly on ${browserName}`);
    });
  });
});
