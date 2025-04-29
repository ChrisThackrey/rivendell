// Debug script to test point selection in Monte Carlo visualization
const { chromium } = require('playwright');

async function debugPointSelection() {
  console.log('Starting Playwright debug session...');
  
  // Launch the browser with GPU acceleration enabled
  const browser = await chromium.launch({
    headless: false, // Run in headed mode to see the browser
    args: ['--enable-webgl', '--use-gl=desktop', '--disable-features=UseOzonePlatform'],
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the Monte Carlo page
    console.log('Navigating to the Monte Carlo page...');
    await page.goto('http://localhost:3000/monte-carlo');
    
    // Wait for the page to load fully
    await page.waitForLoadState('networkidle');
    
    // Wait for the Batch Selection panel to be visible
    await page.waitForSelector('text="Batch Selection"', { timeout: 10000 });
    console.log('Monte Carlo page loaded successfully');
    
    // Click on the first batch in the batch selection sidebar
    console.log('Selecting the first batch...');
    const batchSelector = 'div[role="button"]:has-text("Batch")';
    await page.waitForSelector(batchSelector);
    await page.click(batchSelector);
    
    // Wait for the visualization canvas to load
    console.log('Waiting for visualization canvas to load...');
    await page.waitForFunction(() => {
      return document.querySelector('canvas') !== null;
    }, { timeout: 15000 });
    
    // Take a screenshot of the canvas before interaction
    await page.screenshot({ path: 'before-selection.png' });
    console.log('Screenshot taken before selection');
    
    // Click on a point in the canvas
    // Note: Playwright will click in the center of the canvas by default
    console.log('Attempting to click on a point in the visualization...');
    const canvas = await page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 200 }, timeout: 5000 });
    
    // Check if the selection state changed (can track via changes in the DOM)
    console.log('Checking if selection state changed...');
    await page.waitForTimeout(1000); // wait for selection to register
    
    // Take a screenshot after clicking to see if any visual changes happened
    await page.screenshot({ path: 'after-selection.png' });
    console.log('Screenshot taken after selection');
    
    // Attempt to evaluate if a selection was made
    const selectionInfo = await page.evaluate(() => {
      // Look for any elements that would indicate a selection
      const detailPanels = document.querySelectorAll('[class*="DetailCard"]');
      const selectedElements = document.querySelectorAll('[class*="selected"]');
      
      return {
        detailPanelsFound: detailPanels.length > 0,
        selectedElementsFound: selectedElements.length > 0,
        htmlAfterSelection: document.body.innerHTML.includes('Selected Point'),
      };
    });
    
    console.log('Selection check results:', selectionInfo);
    
    // Now test if rotation maintains the selection
    console.log('Testing if rotating the view maintains selection...');
    
    // Mouse down, move to simulate rotation, then mouse up
    await canvas.mouseDown();
    await page.mouse.move(300, 200);
    await page.mouse.move(400, 200);
    await canvas.mouseUp();
    
    // Take another screenshot after rotation
    await page.screenshot({ path: 'after-rotation.png' });
    console.log('Screenshot taken after rotation');
    
    // Check if selection is still active
    const selectionAfterRotation = await page.evaluate(() => {
      const detailPanels = document.querySelectorAll('[class*="DetailCard"]');
      const selectedElements = document.querySelectorAll('[class*="selected"]');
      
      return {
        detailPanelsFound: detailPanels.length > 0,
        selectedElementsFound: selectedElements.length > 0,
        htmlAfterRotation: document.body.innerHTML.includes('Selected Point'),
      };
    });
    
    console.log('Selection after rotation:', selectionAfterRotation);
    
    console.log('Debugging session completed successfully');
  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

// Run the debugging function
debugPointSelection().catch(console.error);