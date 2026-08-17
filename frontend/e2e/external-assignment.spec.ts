/**
 * E2E Test: External Assignment Flow
 * 
 * Feature: External Assignment
 *   As a Committee Member
 *   I want to assign student groups to external examiners
 *   So that they can conduct final evaluations
 */

import { test, expect } from '@playwright/test';
import { testUsers, testExternalGroup } from './fixtures/test-data';

test.describe('External Assignment Flow', () => {
  test.describe('Committee Member Creates and Assigns External Group', () => {
    test.beforeEach(async ({ page }) => {
      // Login as committee member
      await page.goto('/login');
      
      // Select committee member tab
      await page.click('button:has-text("Committee")');
      
      // Fill login credentials
      await page.fill('input[type="email"]', testUsers.committeeMember.email);
      await page.fill('input[type="password"]', testUsers.committeeMember.password);
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/committee_member/dashboard**');
    });

    test('should navigate to External Management tab', async ({ page }) => {
      // Click on External Management tab
      await page.click('button:has-text("External Management")');
      
      // Verify tab content is visible
      await expect(page.locator('.external-management')).toBeVisible();
    });

    test('should display list of external examiners', async ({ page }) => {
      // Navigate to External Management
      await page.click('button:has-text("External Management")');
      
      // Click on Examiners view
      await page.click('button:has-text("Examiners")');
      
      // Verify examiners list is displayed
      await expect(page.locator('.examiner-card')).toBeVisible();
    });

    test('should create a new external group', async ({ page }) => {
      // Navigate to External Management
      await page.click('button:has-text("External Management")');
      
      // Click on Groups view
      await page.click('button:has-text("Groups")');
      
      // Fill external group form
      await page.fill('input[name="name"]', testExternalGroup.name);
      await page.fill('input[name="semester"]', testExternalGroup.semester);
      await page.fill('input[name="max_groups"]', String(testExternalGroup.maxGroups));
      
      // Select external examiner
      await page.selectOption('select[name="external_examiner"]', { index: 1 });
      
      // Submit form
      await page.click('button:has-text("Create Group")');
      
      // Verify success message or group appears in list
      await expect(page.locator(`text=${testExternalGroup.name}`)).toBeVisible();
    });

    test('should view available student groups for assignment', async ({ page }) => {
      // Navigate to External Management
      await page.click('button:has-text("External Management")');
      
      // Click on Assignments view
      await page.click('button:has-text("Assignments")');
      
      // Verify available groups section is visible
      await expect(page.locator('.available-groups')).toBeVisible();
    });

    test('should assign student group to external group', async ({ page }) => {
      // Navigate to External Management
      await page.click('button:has-text("External Management")');
      
      // Click on Assignments view
      await page.click('button:has-text("Assignments")');
      
      // Wait for groups to load
      await page.waitForSelector('.student-group-item');
      
      // Click assign button on first available group
      await page.click('.student-group-item:first-child button:has-text("Assign")');
      
      // Select external group from dropdown (if modal appears)
      const modal = page.locator('.assign-modal');
      if (await modal.isVisible()) {
        await page.selectOption('.assign-modal select', { index: 1 });
        await page.click('.assign-modal button:has-text("Confirm")');
      }
      
      // Verify assignment success
      await expect(page.locator('.success-message, .assigned-badge')).toBeVisible();
    });

    test('should show assigned groups in external group details', async ({ page }) => {
      // Navigate to External Management
      await page.click('button:has-text("External Management")');
      
      // Click on Groups view
      await page.click('button:has-text("Groups")');
      
      // Click on an external group to view details
      await page.click('.external-group-card:first-child');
      
      // Wait for modal or details view
      await page.waitForSelector('.group-details-modal, .group-details');
      
      // Verify assignments section is visible
      await expect(page.locator('.assignments-list, .assigned-students')).toBeVisible();
    });
  });

  test.describe('External Group Capacity Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login as committee member
      await page.goto('/login');
      await page.click('button:has-text("Committee")');
      await page.fill('input[type="email"]', testUsers.committeeMember.email);
      await page.fill('input[type="password"]', testUsers.committeeMember.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/committee_member/dashboard**');
    });

    test('should show available slots for external group', async ({ page }) => {
      // Navigate to External Management > Groups
      await page.click('button:has-text("External Management")');
      await page.click('button:has-text("Groups")');
      
      // Verify capacity indicator is shown
      await expect(page.locator('.capacity-indicator, .slots-available')).toBeVisible();
    });

    test('should prevent assignment when group is full', async ({ page }) => {
      // Navigate to External Management > Assignments
      await page.click('button:has-text("External Management")');
      await page.click('button:has-text("Assignments")');
      
      // If a group is at capacity, verify the assign button is disabled or shows warning
      const fullGroupCard = page.locator('.external-group-card:has(.full-capacity)');
      if (await fullGroupCard.count() > 0) {
        const assignButton = fullGroupCard.locator('button:has-text("Assign")');
        await expect(assignButton).toBeDisabled();
      }
    });
  });

  test.describe('Delete External Group', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.click('button:has-text("Committee")');
      await page.fill('input[type="email"]', testUsers.committeeMember.email);
      await page.fill('input[type="password"]', testUsers.committeeMember.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/committee_member/dashboard**');
    });

    test('should delete external group', async ({ page }) => {
      // Navigate to External Management > Groups
      await page.click('button:has-text("External Management")');
      await page.click('button:has-text("Groups")');
      
      // Get initial count
      const initialCount = await page.locator('.external-group-card').count();
      
      // Click delete on first group (if empty)
      const deleteButton = page.locator('.external-group-card:first-child button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion if dialog appears
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        // Verify group was deleted
        await expect(page.locator('.external-group-card')).toHaveCount(initialCount - 1);
      }
    });
  });
});
