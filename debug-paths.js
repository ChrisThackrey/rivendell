// @ts-check
const { chromium } = require('playwright');

/**
 * This script uses Playwright to debug the issues with path connections
 * It will:
 * 1. Navigate to our debug page
 * 2. Take screenshots during different stages
 * 3. Test both original and fixed implementations
 * 4. Extract SVG path information for analysis
 */
async function debugPaths() {
  console.log('Starting Path Connection debugging...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to our debug page
    await page.goto('http://localhost:3001/debug-path-connections');
    console.log('Navigated to debug page');
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/initial-state.png' });
    console.log('📸 Captured initial state');
    
    // Toggle to show only original paths
    await page.click('#showNewPaths');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/original-paths-only.png' });
    console.log('📸 Captured original paths only');
    
    // Extract path information for original implementation
    const originalPathData = await extractPathData(page, 'original');
    console.log('Original implementation path data:', originalPathData);
    
    // Toggle to show only fixed paths
    await page.click('#showOldPaths');
    await page.click('#showNewPaths');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/fixed-paths-only.png' });
    console.log('📸 Captured fixed paths only');
    
    // Extract path information for fixed implementation
    const fixedPathData = await extractPathData(page, 'fixed');
    console.log('Fixed implementation path data:', fixedPathData);
    
    // Compare path implementations
    console.log('\nComparison Summary:');
    console.log('-------------------');
    console.log(`Original SVG container size: ${originalPathData.svgWidth}x${originalPathData.svgHeight}`);
    console.log(`Fixed SVG container size: ${fixedPathData.svgWidth}x${fixedPathData.svgHeight}`);
    console.log(`Original overflow setting: ${originalPathData.overflow}`);
    console.log(`Fixed overflow setting: ${fixedPathData.overflow}`);
    
    // Show both implementations and click recalculate
    await page.click('#showOldPaths');
    await page.waitForTimeout(500);
    
    // Try to find and click recalculate buttons
    await clickRecalculate(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/after-recalculation.png' });
    console.log('📸 Captured state after recalculation');

  } catch (error) {
    console.error('Error during debugging:', error);
    await page.screenshot({ path: 'screenshots/error-state.png' });
  } finally {
    await browser.close();
    console.log('Debug session completed');
  }
}

/**
 * Extract path data from the page
 */
async function extractPathData(page, implementationType) {
  const containerSelector = implementationType === 'original' 
    ? '[data-from-id="card1"]:not([data-component])'
    : '[data-component="path-line-container"]';
  
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector);
    if (!container) return { error: 'Container not found' };
    
    const svg = container.querySelector('svg');
    if (!svg) return { error: 'SVG not found' };
    
    const path = svg.querySelector('path');
    if (!path) return { error: 'Path not found' };
    
    const containerStyle = window.getComputedStyle(container);
    const svgStyle = window.getComputedStyle(svg);
    
    return {
      containerPosition: {
        left: containerStyle.left,
        top: containerStyle.top,
        width: containerStyle.width,
        height: containerStyle.height
      },
      svgWidth: parseInt(svgStyle.width),
      svgHeight: parseInt(svgStyle.height),
      overflow: containerStyle.overflow,
      pathData: path.getAttribute('d'),
      strokeWidth: path.getAttribute('stroke-width'),
      stroke: path.getAttribute('stroke')
    };
  }, containerSelector);
}

/**
 * Try to click recalculate buttons if they exist
 */
async function clickRecalculate(page) {
  try {
    const buttons = await page.$$('text="Recalculate Path"');
    for (const button of buttons) {
      await button.click();
      console.log('Clicked a Recalculate Path button');
    }
  } catch (error) {
    console.log('Could not find Recalculate Path buttons:', error.message);
  }
}

// Run the script
debugPaths().catch(console.error);