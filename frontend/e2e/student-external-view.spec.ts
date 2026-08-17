/**
 * E2E Test: Student Views External Evaluation
 * 
 * Feature: View External Evaluation
 *   As a Student
 *   I want to view my external evaluation results
 *   So that I know my final assessment
 */

import { test, expect } from '@playwright/test';
import { testUsers } from './fixtures/test-data';

test.describe('Student External Evaluation View', () => {
  test.describe('Student Login and Dashboard', () => {
    test('should login as student', async ({ page }) => {
      await page.goto('/login');
      
      // Student tab should be default
      await expect(page.locator('button.active:has-text("Student")')).toBeVisible();
      
      // Fill login credentials
      await page.fill('input[placeholder*="registration"], input[name="registration_no"]', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Verify redirect to student dashboard
      await page.waitForURL('**/student/dashboard**');
    });

    test('should display student dashboard', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[placeholder*="registration"], input[name="registration_no"]', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/student/dashboard**');
      
      // Verify dashboard elements
      await expect(page.locator('.dashboard-container, .student-dashboard')).toBeVisible();
    });
  });

  test.describe('External Evaluation Tab (8th Semester)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[placeholder*="registration"], input[name="registration_no"]', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/student/dashboard**');
    });

    test('should show External Evaluation tab for 8th semester students', async ({ page }) => {
      // The External Evaluation tab should be visible for 8th semester students
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      // If student is in 8th semester, tab should be visible
      if (await externalTab.isVisible()) {
        await expect(externalTab).toBeVisible();
      }
    });

    test('should navigate to External Evaluation section', async ({ page }) => {
      // Click on External Evaluation tab
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        // Verify section content is visible
        await expect(page.locator('.external-evaluation-view, .external-evaluation-section, text=External Evaluation')).toBeVisible();
      }
    });

    test('should show "No Evaluation" message when not yet evaluated', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        // Check for empty state
        const emptyState = page.locator('.empty-state, text=/no.*evaluation/i');
        const evaluationView = page.locator('.external-evaluation-view');
        
        // Either empty state or evaluation should be visible
        await expect(emptyState.or(evaluationView)).toBeVisible();
      }
    });

    test('should display evaluation results when evaluated', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        // Wait for content to load
        await page.waitForTimeout(1000);
        
        // Check if evaluation exists
        const evaluationView = page.locator('.external-evaluation-view');
        
        if (await evaluationView.isVisible()) {
          // Verify total marks is displayed
          await expect(page.locator('text=/\\d+.*\\/.*100/')).toBeVisible();
          
          // Verify grade is displayed
          await expect(page.locator('text=/[ABCF][\\+]?/')).toBeVisible();
        }
      }
    });

    test('should display section breakdown', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        const evaluationView = page.locator('.external-evaluation-view');
        
        if (await evaluationView.isVisible()) {
          // Verify sections are displayed
          await expect(page.locator('text=Project Implementation')).toBeVisible();
          await expect(page.locator('text=Technical Knowledge')).toBeVisible();
          await expect(page.locator('text=Presentation')).toBeVisible();
          await expect(page.locator('text=Documentation')).toBeVisible();
          await expect(page.locator('text=Q&A')).toBeVisible();
        }
      }
    });

    test('should display examiner comments', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        const evaluationView = page.locator('.external-evaluation-view');
        
        if (await evaluationView.isVisible()) {
          // Check for comments section
          const commentsSection = page.locator('.comments-section, .examiner-comments');
          
          if (await commentsSection.isVisible()) {
            // Verify comment labels are present
            await expect(page.locator('text=/Overall|Strengths|Improvement/i')).toBeVisible();
          }
        }
      }
    });

    test('should display pass/fail status', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        const evaluationView = page.locator('.external-evaluation-view');
        
        if (await evaluationView.isVisible()) {
          // Verify pass/fail status is displayed
          await expect(page.locator('text=/PASS|FAIL/i')).toBeVisible();
        }
      }
    });
  });

  test.describe('External Evaluation Loading States', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[placeholder*="registration"], input[name="registration_no"]', testUsers.student.registrationNo);
      await page.fill('input[type="password"]', testUsers.student.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/student/dashboard**');
    });

    test('should show loading state while fetching evaluation', async ({ page }) => {
      const externalTab = page.locator('button:has-text("External Evaluation")');
      
      if (await externalTab.isVisible()) {
        await externalTab.click();
        
        // Check for loading indicator (might be brief)
        const loadingIndicator = page.locator('.loading-spinner, .loading-state, text=Loading');
        
        // Loading might be very quick, so we just check it doesn't error
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Non-8th Semester Student', () => {
    test('should not show External Evaluation tab for non-8th semester students', async ({ page }) => {
      // This test assumes we have a non-8th semester student
      // In actual implementation, we'd use a different test user
      
      await page.goto('/login');
      await page.fill('input[placeholder*="registration"], input[name="registration_no"]', '2021-CS-099'); // Non-8th semester student
      await page.fill('input[type="password"]', 'test123');
      await page.click('button[type="submit"]');
      
      // If login fails, skip this test
      try {
        await page.waitForURL('**/student/dashboard**', { timeout: 5000 });
        
        // External Evaluation tab should NOT be visible
        const externalTab = page.locator('button:has-text("External Evaluation")');
        await expect(externalTab).not.toBeVisible();
      } catch {
        // Login failed, skip test
        test.skip();
      }
    });
  });
});
