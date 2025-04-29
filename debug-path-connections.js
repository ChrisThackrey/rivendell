const { chromium } = require('playwright');

async function debugPathConnections() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to our debug page
  await page.goto('http://localhost:3001/debug-paths');
  console.log('Navigated to debug page');
  
  // Wait for the page to settle
  await page.waitForTimeout(2000);
  
  // Take a screenshot of initial state
  await page.screenshot({ path: 'debug-initial.png' });
  console.log('Captured initial screenshot');
  
  // Inspect DOM structure for connection points
  const connectionPoints = await page.$$eval('[data-connection-id]', points => 
    points.map(p => ({
      id: p.getAttribute('data-connection-id'),
      rect: p.getBoundingClientRect()
    }))
  );
  console.log('Connection points:', connectionPoints);
  
  // Check SVG paths
  const paths = await page.$$eval('path', paths => 
    paths.map(p => ({
      d: p.getAttribute('d'),
      fromId: p.getAttribute('data-from-id'),
      toId: p.getAttribute('data-to-id')
    }))
  );
  console.log('SVG paths:', paths);
  
  // Wait for animation to complete
  await page.waitForTimeout(2000);
  
  // Take another screenshot after animation
  await page.screenshot({ path: 'debug-after-animation.png' });
  console.log('Captured post-animation screenshot');
  
  // Enable debug mode
  await page.click('text=Debug Mode');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'debug-mode.png' });
  console.log('Captured debug mode screenshot');
  
  // Force recalculation
  try {
    await page.click('text=Recalculate Path');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'after-recalculation.png' });
    console.log('Captured after recalculation screenshot');
  } catch (e) {
    console.log('Could not find recalculate button:', e);
  }
  
  await browser.close();
}

debugPathConnections().catch(console.error);