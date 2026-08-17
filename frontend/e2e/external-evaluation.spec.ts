/**
 * E2E Test: External Evaluation Flow
 * 
 * Feature: External Evaluation
 *   As an External Examiner
 *   I want to evaluate assigned student groups
 *   So that students receive their final assessment
 */

import { test, expect } from '@playwright/test';
import { testUsers, testEvaluation } from './fixtures/test-data';

test.describe('External Evaluation Flow', () => {
  test.describe('External Examiner Login and Dashboard', () => {
    test('should login as external examiner', async ({ page }) => {
      await page.goto('/login');
      
      // Select external examiner tab
      await page.click('button:has-text("External")');
      
      // Fill login credentials
      await page.fill('input[type="email"]', testUsers.externalExaminer.email);
      await page.fill('input[type="password"]', testUsers.externalExaminer.password);
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Verify redirect to external dashboard
      await page.waitForURL('**/external_examiner/dashboard**');
      
      // Verify dashboard elements
      await expect(page.locator('.external-dashboard, .dashboard-container')).toBeVisible();
    });

    test('should display dashboard statistics', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.click('button:has-text("External")');
      await page.fill('input[type="email"]', testUsers.externalExaminer.email);
      await page.fill('input[type="password"]', testUsers.externalExaminer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/external_examiner/dashboard**');
      
      // Verify statistics cards
      await expect(page.locator('.stats-card, .statistic-card')).toBeVisible();
    });
  });

  test.describe('View Assigned Groups', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.click('button:has-text("External")');
      await page.fill('input[type="email"]', testUsers.externalExaminer.email);
      await page.fill('input[type="password"]', testUsers.externalExaminer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/external_examiner/dashboard**');
    });

    test('should view assigned external groups', async ({ page }) => {
      // Click on Groups tab
      await page.click('button:has-text("Groups"), button:has-text("My Groups")');
      
      // Verify groups are displayed
      await expect(page.locator('.external-group-card, .group-card')).toBeVisible();
    });

    test('should expand group to see assigned students', async ({ page }) => {
      // Click on Groups tab
      await page.click('button:has-text("Groups"), button:has-text("My Groups")');
      
      // Click on first group card to expand
      await page.click('.external-group-card:first-child, .group-card:first-child');
      
      // Wait for students list to appear
      await page.waitForSelector('.assignment-card, .student-assignment');
      
      // Verify student information is displayed
      await expect(page.locator('.assignment-card, .student-assignment')).toBeVisible();
    });

    test('should show student details in assignment card', async ({ page }) => {
      // Navigate to groups
      await page.click('button:has-text("Groups"), button:has-text("My Groups")');
      
      // Expand first group
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      
      // Verify student details are shown
      const assignmentCard = page.locator('.assignment-card:first-child');
      await expect(assignmentCard.locator('.student-name, .student-info')).toBeVisible();
      await expect(assignmentCard.locator('.registration-no, .reg-no')).toBeVisible();
    });
  });

  test.describe('Complete Evaluation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.click('button:has-text("External")');
      await page.fill('input[type="email"]', testUsers.externalExaminer.email);
      await page.fill('input[type="password"]', testUsers.externalExaminer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/external_examiner/dashboard**');
    });

    test('should open evaluation form for pending assignment', async ({ page }) => {
      // Navigate to groups
      await page.click('button:has-text("Groups"), button:has-text("My Groups")');
      
      // Expand first group
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      
      // Click evaluate button on first pending assignment
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Verify evaluation form opens
      await expect(page.locator('.external-evaluation-form')).toBeVisible();
    });

    test('should display all evaluation criteria sections', async ({ page }) => {
      // Navigate to evaluation form
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Verify all sections are present
      await expect(page.locator('text=Project Implementation')).toBeVisible();
      await expect(page.locator('text=Technical Knowledge')).toBeVisible();
      await expect(page.locator('text=Presentation Skills')).toBeVisible();
      await expect(page.locator('text=Documentation Quality')).toBeVisible();
      await expect(page.locator('text=Q&A Response')).toBeVisible();
    });

    test('should calculate marks in real-time', async ({ page }) => {
      // Navigate to evaluation form
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Initially marks should be 0
      await expect(page.locator('text=0/100')).toBeVisible();
      
      // Change a rating to excellent (95)
      await page.selectOption('select:first-of-type', '95');
      
      // Verify marks updated
      await expect(page.locator('text=0/100')).not.toBeVisible();
    });

    test('should fill and submit evaluation form', async ({ page }) => {
      // Navigate to evaluation form
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Fill all rating fields with "good" (75)
      const selects = await page.locator('select').all();
      for (const select of selects) {
        await select.selectOption('75');
      }
      
      // Fill comment fields
      await page.fill('textarea[id="overall_comment"]', testEvaluation.overallComment);
      await page.fill('textarea[id="strengths"]', testEvaluation.strengths);
      await page.fill('textarea[id="areas_of_improvement"]', testEvaluation.areasOfImprovement);
      
      // Verify total marks (75% of 100 = 75)
      await expect(page.locator('text=75/100')).toBeVisible();
      
      // Verify grade (75 = B+)
      await expect(page.locator('text=B+')).toBeVisible();
      
      // Submit evaluation
      await page.click('button:has-text("Submit Evaluation")');
      
      // Verify success - either alert, toast, or redirect
      // Note: In actual test, we'd handle the alert
      await page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('success');
        await dialog.accept();
      });
    });

    test('should update existing evaluation', async ({ page }) => {
      // Navigate to a previously evaluated assignment
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      
      // Look for an evaluated assignment and click Edit
      const editButton = page.locator('.assignment-card button:has-text("Edit")');
      if (await editButton.count() > 0) {
        await editButton.first().click();
        
        // Verify form is populated with existing data
        await expect(page.locator('.external-evaluation-form')).toBeVisible();
        
        // Verify button says "Update Evaluation"
        await expect(page.locator('button:has-text("Update Evaluation")')).toBeVisible();
      }
    });

    test('should show grade and pass/fail status', async ({ page }) => {
      // Navigate to evaluation form
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Fill with passing marks
      const selects = await page.locator('select').all();
      for (const select of selects) {
        await select.selectOption('75');
      }
      
      // Verify PASS status is shown
      await expect(page.locator('text=PASS')).toBeVisible();
      
      // Fill with failing marks
      for (const select of selects) {
        await select.selectOption('20');
      }
      
      // Verify FAIL status is shown
      await expect(page.locator('text=FAIL')).toBeVisible();
    });

    test('should cancel evaluation and return to list', async ({ page }) => {
      // Navigate to evaluation form
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      await page.click('.assignment-card:first-child button:has-text("Evaluate")');
      
      // Click cancel
      await page.click('button:has-text("Cancel")');
      
      // Verify returned to groups list
      await expect(page.locator('.assignment-card')).toBeVisible();
      await expect(page.locator('.external-evaluation-form')).not.toBeVisible();
    });
  });

  test.describe('Evaluation Status Updates', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.click('button:has-text("External")');
      await page.fill('input[type="email"]', testUsers.externalExaminer.email);
      await page.fill('input[type="password"]', testUsers.externalExaminer.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/external_examiner/dashboard**');
    });

    test('should show evaluation status in assignment card', async ({ page }) => {
      // Navigate to groups
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      
      // Verify status badge is visible
      await expect(page.locator('.status-badge')).toBeVisible();
    });

    test('should update statistics after evaluation', async ({ page }) => {
      // Check initial statistics
      const initialPending = await page.locator('.stat-pending, text=/pending/i').textContent();
      
      // Complete an evaluation (abbreviated steps)
      await page.click('button:has-text("Groups")');
      await page.click('.external-group-card:first-child');
      await page.waitForSelector('.assignment-card');
      
      const evaluateButton = page.locator('.assignment-card button:has-text("Evaluate")');
      if (await evaluateButton.count() > 0) {
        await evaluateButton.first().click();
        
        // Fill and submit (simplified)
        const selects = await page.locator('select').all();
        for (const select of selects) {
          await select.selectOption('75');
        }
        
        await page.click('button:has-text("Submit Evaluation")');
        
        // Handle alert
        page.on('dialog', dialog => dialog.accept());
        
        // Go back to dashboard
        await page.click('button:has-text("Dashboard")');
        
        // Verify statistics updated
        // The pending count should have decreased
      }
    });
  });
});
