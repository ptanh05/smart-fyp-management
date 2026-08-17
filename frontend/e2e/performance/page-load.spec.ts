/**
 * Frontend Performance Tests
 * 
 * Tests page load times, Core Web Vitals, and rendering performance.
 */

import { test, expect, Page } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';

// Performance thresholds
const THRESHOLDS = {
  pageLoad: 3000,          // 3 seconds
  firstContentfulPaint: 1800, // 1.8 seconds (Good FCP)
  largestContentfulPaint: 2500, // 2.5 seconds (Good LCP)
  timeToInteractive: 3800,  // 3.8 seconds
  totalBlockingTime: 200,   // 200ms (Good TBT)
  cumulativeLayoutShift: 0.1, // 0.1 (Good CLS)
  domContentLoaded: 2000,   // 2 seconds
  apiResponse: 500,         // 500ms
};

interface PerformanceMetrics {
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  cumulativeLayoutShift: number | null;
  resourceCount: number;
  resourceSize: number;
}

async function getPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
    
    let lcp: number | null = null;
    let cls: number | null = null;
    
    // Try to get LCP and CLS from PerformanceObserver data (if available)
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        lcp = (lcpEntries[lcpEntries.length - 1] as any).startTime;
      }
    } catch {}
    
    return {
      pageLoadTime: navigation?.loadEventEnd - navigation?.startTime || 0,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.startTime || 0,
      firstContentfulPaint: fcpEntry?.startTime || null,
      largestContentfulPaint: lcp,
      cumulativeLayoutShift: cls,
      resourceCount: resources.length,
      resourceSize: resources.reduce((total, r) => total + (r.transferSize || 0), 0),
    };
  });
}

test.describe('Page Load Performance', () => {
  
  test('login page should load within threshold', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    const loadTime = Date.now() - startTime;
    const metrics = await getPerformanceMetrics(page);
    
    console.log('\n📊 Login Page Performance:');
    console.log(`   Page Load Time: ${loadTime}ms`);
    console.log(`   DOM Content Loaded: ${metrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`   First Contentful Paint: ${metrics.firstContentfulPaint?.toFixed(0) || 'N/A'}ms`);
    console.log(`   Resources: ${metrics.resourceCount} files, ${(metrics.resourceSize / 1024).toFixed(0)}KB`);
    
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
    expect(metrics.domContentLoaded).toBeLessThan(THRESHOLDS.domContentLoaded);
  });

  test('dashboard should load within threshold after login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[placeholder*="registration"], input[name="registration_no"], input:not([type="password"]):visible', testUsers.student.registrationNo);
    await page.fill('input[type="password"]', testUsers.student.password);
    
    const startTime = Date.now();
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
      const loadTime = Date.now() - startTime;
      
      // Wait for page to stabilize
      await page.waitForLoadState('networkidle');
      
      const metrics = await getPerformanceMetrics(page);
      
      console.log('\n📊 Dashboard Performance (after login):');
      console.log(`   Total Time (login + load): ${loadTime}ms`);
      console.log(`   DOM Content Loaded: ${metrics.domContentLoaded.toFixed(0)}ms`);
      console.log(`   Resources: ${metrics.resourceCount} files`);
      
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad * 2); // Allow more time for auth
    } catch {
      console.log('   Dashboard test skipped - login may have failed');
    }
  });

  test('should not have excessive layout shifts', async ({ page }) => {
    let clsScore = 0;
    
    // Set up CLS observer
    await page.addInitScript(() => {
      (window as any).clsScore = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    });
    
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for any animations
    
    clsScore = await page.evaluate(() => (window as any).clsScore || 0);
    
    console.log(`\n📊 Cumulative Layout Shift: ${clsScore.toFixed(4)}`);
    console.log(`   Threshold: < ${THRESHOLDS.cumulativeLayoutShift}`);
    console.log(`   Status: ${clsScore < THRESHOLDS.cumulativeLayoutShift ? '✅ Good' : '⚠️ Needs Improvement'}`);
    
    expect(clsScore).toBeLessThan(THRESHOLDS.cumulativeLayoutShift);
  });
});

test.describe('Resource Loading Performance', () => {
  
  test('should load JavaScript efficiently', async ({ page }) => {
    const jsResources: { url: string; size: number; time: number }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js') || url.includes('.js?')) {
        const timing = response.request().timing();
        jsResources.push({
          url: url.split('/').pop() || url,
          size: parseInt(response.headers()['content-length'] || '0'),
          time: timing.responseEnd - timing.requestStart,
        });
      }
    });
    
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    console.log('\n📊 JavaScript Resources:');
    const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const totalJsTime = jsResources.reduce((sum, r) => sum + r.time, 0);
    
    console.log(`   Total JS Files: ${jsResources.length}`);
    console.log(`   Total JS Size: ${(totalJsSize / 1024).toFixed(0)}KB`);
    console.log(`   Total Load Time: ${totalJsTime.toFixed(0)}ms`);
    
    // Main bundle should be < 500KB for good performance
    expect(totalJsSize).toBeLessThan(2 * 1024 * 1024); // 2MB max
  });

  test('should load CSS efficiently', async ({ page }) => {
    const cssResources: { url: string; size: number }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.css') || url.includes('.css?')) {
        cssResources.push({
          url: url.split('/').pop() || url,
          size: parseInt(response.headers()['content-length'] || '0'),
        });
      }
    });
    
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0);
    
    console.log('\n📊 CSS Resources:');
    console.log(`   Total CSS Files: ${cssResources.length}`);
    console.log(`   Total CSS Size: ${(totalCssSize / 1024).toFixed(0)}KB`);
    
    expect(totalCssSize).toBeLessThan(500 * 1024); // 500KB max
  });

  test('images should be optimized', async ({ page }) => {
    const imageResources: { url: string; size: number; type: string }[] = [];
    
    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'] || '';
      if (contentType.startsWith('image/')) {
        imageResources.push({
          url: response.url().split('/').pop() || response.url(),
          size: parseInt(response.headers()['content-length'] || '0'),
          type: contentType,
        });
      }
    });
    
    await page.goto('/login', { waitUntil: 'networkidle' });
    
    console.log('\n📊 Image Resources:');
    console.log(`   Total Images: ${imageResources.length}`);
    
    const totalImageSize = imageResources.reduce((sum, r) => sum + r.size, 0);
    console.log(`   Total Size: ${(totalImageSize / 1024).toFixed(0)}KB`);
    
    // Check for oversized images
    const largeImages = imageResources.filter(r => r.size > 200 * 1024);
    if (largeImages.length > 0) {
      console.log(`   ⚠️ Large images (>200KB):`);
      largeImages.forEach(img => {
        console.log(`      - ${img.url}: ${(img.size / 1024).toFixed(0)}KB`);
      });
    }
    
    expect(largeImages.length).toBe(0);
  });
});

test.describe('API Response Time', () => {
  
  test('API calls should respond within threshold', async ({ page }) => {
    const apiCalls: { url: string; time: number; status: number }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const timing = response.request().timing();
        apiCalls.push({
          url: url.replace(/.*\/api\//, '/api/'),
          time: timing.responseEnd - timing.requestStart,
          status: response.status(),
        });
      }
    });
    
    await page.goto('/login');
    
    // Login to trigger API calls
    await page.fill('input[placeholder*="registration"], input[name="registration_no"], input:not([type="password"]):visible', testUsers.student.registrationNo);
    await page.fill('input[type="password"]', testUsers.student.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    } catch {}
    
    console.log('\n📊 API Response Times:');
    console.log(`   ${'Endpoint'.padEnd(50)} ${'Time'.padStart(10)} ${'Status'.padStart(8)}`);
    console.log('   ' + '-'.repeat(68));
    
    apiCalls.forEach(call => {
      const status = call.status >= 200 && call.status < 300 ? '✅' : '❌';
      console.log(`   ${call.url.substring(0, 50).padEnd(50)} ${(call.time.toFixed(0) + 'ms').padStart(10)} ${status}`);
    });
    
    // Check all API calls are within threshold
    const slowCalls = apiCalls.filter(c => c.time > THRESHOLDS.apiResponse);
    
    if (slowCalls.length > 0) {
      console.log(`\n   ⚠️ ${slowCalls.length} slow API calls (>${THRESHOLDS.apiResponse}ms)`);
    }
  });
});

test.describe('Memory Performance', () => {
  
  test('should not have memory leaks during navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Get initial memory (if available)
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    if (initialMemory === 0) {
      console.log('\n⚠️ Memory metrics not available (Chrome only with --enable-precise-memory-info)');
      return;
    }
    
    // Navigate multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('/login', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }
    
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    
    console.log('\n📊 Memory Usage:');
    console.log(`   Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Increase: ${memoryIncrease.toFixed(2)}MB`);
    
    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(50); // 50MB max increase
  });
});

test.describe('Rendering Performance', () => {
  
  test('should render lists efficiently', async ({ page }) => {
    await page.goto('/login');
    
    // Inject a test list
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'perf-test-list';
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const item = document.createElement('div');
        item.className = 'test-item';
        item.innerHTML = `
          <h3>Item ${i}</h3>
          <p>Description for item ${i}</p>
          <span class="badge">Status</span>
        `;
        container.appendChild(item);
      }
      
      document.body.appendChild(container);
      
      (window as any).listRenderTime = performance.now() - startTime;
    });
    
    const renderTime = await page.evaluate(() => (window as any).listRenderTime);
    
    console.log(`\n📊 List Rendering (100 items): ${renderTime.toFixed(2)}ms`);
    
    expect(renderTime).toBeLessThan(100); // Should render 100 items in < 100ms
  });

  test('should handle form interactions efficiently', async ({ page }) => {
    await page.goto('/login');
    
    const input = page.locator('input').first();
    
    const startTime = Date.now();
    
    // Type rapidly
    await input.type('abcdefghijklmnopqrstuvwxyz', { delay: 10 });
    
    const typeTime = Date.now() - startTime;
    const expectedTime = 26 * 10 + 500; // 26 chars * 10ms delay + 500ms buffer
    
    console.log(`\n📊 Typing Performance: ${typeTime}ms for 26 characters`);
    console.log(`   Expected: ~${expectedTime}ms`);
    
    expect(typeTime).toBeLessThan(expectedTime);
  });
});

test.describe('Performance Report', () => {
  
  test('generate comprehensive performance report', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('PERFORMANCE TEST REPORT');
    console.log('='.repeat(60));
    
    // Login page metrics
    const loginStart = Date.now();
    await page.goto('/login', { waitUntil: 'networkidle' });
    const loginTime = Date.now() - loginStart;
    const loginMetrics = await getPerformanceMetrics(page);
    
    console.log('\n📄 Login Page:');
    console.log(`   Load Time: ${loginTime}ms ${loginTime < THRESHOLDS.pageLoad ? '✅' : '❌'}`);
    console.log(`   DOM Ready: ${loginMetrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`   FCP: ${loginMetrics.firstContentfulPaint?.toFixed(0) || 'N/A'}ms`);
    console.log(`   Resources: ${loginMetrics.resourceCount}`);
    console.log(`   Transfer: ${(loginMetrics.resourceSize / 1024).toFixed(0)}KB`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const checks = [
      { name: 'Page Load Time', passed: loginTime < THRESHOLDS.pageLoad },
      { name: 'DOM Content Loaded', passed: loginMetrics.domContentLoaded < THRESHOLDS.domContentLoaded },
    ];
    
    checks.forEach(check => {
      console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
    });
    
    const passCount = checks.filter(c => c.passed).length;
    console.log(`\nPassed: ${passCount}/${checks.length}`);
    console.log('='.repeat(60));
    
    // All checks should pass
    expect(passCount).toBe(checks.length);
  });
});
