// Debug script for Monte Carlo visualization
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugMonteCarloVisualization() {
  console.log('Starting Monte Carlo visualization debug...');
  
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, 'debug-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }
  
  // Launch browser with GPU enabled
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-webgl']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to Monte Carlo page
    console.log('Navigating to Monte Carlo page...');
    await page.goto('http://localhost:3000/monte-carlo');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial page
    await page.screenshot({ path: path.join(screenshotsDir, '01-initial-page.png') });
    console.log('Initial page loaded');
    
    // Add debug instrumentation to track state updates
    await page.evaluate(() => {
      window.monteCarloDebug = {
        events: [],
        selectedPoint: null,
        logEvent: function(eventName, data) {
          const event = { time: new Date().toISOString(), event: eventName, data };
          console.log('MONTE-CARLO-DEBUG:', event);
          this.events.push(event);
        }
      };

      // Patch the setState function to log state changes
      const originalSetState = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current.useState;
      if (originalSetState) {
        // Try to monkey-patch state updates (this may not work due to React's architecture)
        try {
          React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current.useState = function(...args) {
            const [state, setState] = originalSetState.apply(this, args);
            
            if (state && typeof state === 'object' && state.hasOwnProperty('id') && state.hasOwnProperty('model')) {
              window.monteCarloDebug.logEvent('useState-point', { id: state.id, model: state.model });
              window.monteCarloDebug.selectedPoint = state;
            }
            
            return [state, setState];
          };
        } catch (e) {
          console.log('Failed to patch useState', e);
        }
      }
    });
    
    // Select the first batch to load the visualization
    console.log('Selecting the first batch...');
    const batchSelector = '.flex.flex-col.gap-1 > div[role="button"]';
    await page.waitForSelector(batchSelector, { timeout: 10000 });
    
    // Take screenshot before selecting batch
    await page.screenshot({ path: path.join(screenshotsDir, '02-before-batch-selection.png') });
    
    // Click the first batch
    await page.click(batchSelector);
    console.log('Batch selected, waiting for visualization to load...');
    
    // Wait for the canvas to appear
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(2000); // Give time for the visualization to fully render
    
    // Take screenshot after visualization loads
    await page.screenshot({ path: path.join(screenshotsDir, '03-visualization-loaded.png') });
    
    // Check if details panel is visible
    const detailsPanelExists = await page.isVisible('.Monte-CarloDetailsPanel, div[class*="DetailsPanel"]');
    console.log('Details panel exists:', detailsPanelExists);
    
    // Log DOM structure around the visualization to help with debugging
    const domInfo = await page.evaluate(() => {
      const canvasElement = document.querySelector('canvas');
      if (!canvasElement) return { error: 'Canvas not found' };
      
      // Get parent structure
      const parentChain = [];
      let parent = canvasElement.parentElement;
      while (parent && parentChain.length < 5) {
        parentChain.push({
          tagName: parent.tagName,
          id: parent.id,
          className: parent.className,
          childCount: parent.children.length
        });
        parent = parent.parentElement;
      }
      
      // Check for event listeners on canvas (not fully reliable, but helpful)
      const canvasProps = Object.getOwnPropertyNames(canvasElement);
      const hasEventProps = canvasProps.some(prop => prop.startsWith('on'));
      
      return {
        canvasPosition: {
          x: canvasElement.offsetLeft,
          y: canvasElement.offsetTop,
          width: canvasElement.width,
          height: canvasElement.height
        },
        parentChain,
        hasEventProps,
        visibleButtons: Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent,
          visible: b.offsetParent !== null,
          rect: b.getBoundingClientRect()
        })),
        detailsPanel: {
          exists: !!document.querySelector('.Monte-CarloDetailsPanel, div[class*="DetailsPanel"]'),
          visible: !!document.querySelector('.Monte-CarloDetailsPanel:not([style*="display: none"]), div[class*="DetailsPanel"]:not([style*="display: none"])')
        }
      };
    });
    
    console.log('DOM structure info:', JSON.stringify(domInfo, null, 2));
    
    // Try clicking at multiple points on the canvas to find a point
    console.log('Attempting to click on points in the visualization...');
    const canvas = await page.locator('canvas');
    const canvasBounds = await canvas.boundingBox();
    
    // Define a grid of positions to try clicking
    const positions = [
      { x: canvasBounds.width / 2, y: canvasBounds.height / 2 }, // Center
      { x: canvasBounds.width / 3, y: canvasBounds.height / 3 }, // Top left quadrant
      { x: canvasBounds.width * 2/3, y: canvasBounds.height / 3 }, // Top right quadrant
      { x: canvasBounds.width / 3, y: canvasBounds.height * 2/3 }, // Bottom left quadrant
      { x: canvasBounds.width * 2/3, y: canvasBounds.height * 2/3 } // Bottom right quadrant
    ];
    
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      console.log(`Clicking at position ${i+1}:`, pos);
      
      // Click on this position
      await canvas.click({ 
        position: { x: pos.x, y: pos.y },
        timeout: 5000,
        force: true // Use force click to bypass any event handling issues
      });
      
      // Wait for any selection to take effect
      await page.waitForTimeout(1000);
      
      // Take screenshot after clicking
      await page.screenshot({ path: path.join(screenshotsDir, `04-after-click-${i+1}.png`) });
      
      // Check for any visual changes indicating selection
      const selectionState = await page.evaluate(() => {
        return {
          selectedPoint: window.monteCarloDebug?.selectedPoint,
          detailsPanelVisible: !!document.querySelector('.Monte-CarloDetailsPanel:not([style*="display: none"]), div[class*="DetailsPanel"]:not([style*="display: none"])'),
          selectedElementExists: !!document.querySelector('[class*="selected"], [aria-selected="true"]'),
          eventLog: window.monteCarloDebug?.events || []
        };
      });
      
      console.log(`Selection state after click ${i+1}:`, JSON.stringify(selectionState, null, 2));
    }
    
    // Check for console errors
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });
    
    console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
    
  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    // Save the execution trace to a file
    const debugData = await page.evaluate(() => {
      return {
        selectedPoint: window.monteCarloDebug?.selectedPoint,
        events: window.monteCarloDebug?.events || [],
        reactInstalled: !!window.React
      };
    });
    
    fs.writeFileSync(
      path.join(screenshotsDir, 'debug-data.json'), 
      JSON.stringify(debugData, null, 2)
    );
    
    console.log('Debug data saved to debug-data.json');
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the debug script
debugMonteCarloVisualization().catch(console.error);