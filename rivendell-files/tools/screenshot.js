const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function takeScreenshot() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1280,
      height: 800
    },
    args: ['--no-sandbox']
  });

  try {
    console.log("Opening page...");
    const page = await browser.newPage();
    
    // Navigate to the monte-carlo page
    await page.goto('http://localhost:3000/monte-carlo', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log("Page loaded, waiting for 3D visualization to render...");
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Give some time for the 3D visualization to fully render
    await page.waitForTimeout(5000);
    
    // Take a screenshot and save it to the project directory
    const screenshotPath = path.join(__dirname, '../monte-carlo-screenshot.png');
    console.log(`Taking screenshot and saving to ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
    
    console.log(`Screenshot saved to ${screenshotPath}`);
  } catch (error) {
    console.error("Error taking screenshot:", error);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

takeScreenshot();