#!/usr/bin/env node

/**
 * This script helps with deploying the project to Vercel
 * It checks for required environment variables and runs deployment commands
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Vercel Deployment Helper');
console.log('===========================\n');

// Check if vercel is installed
try {
  execSync('npx vercel --version', { stdio: 'pipe' });
} catch (error) {
  console.log('❌ Vercel CLI is not installed. Installing now...');
  try {
    execSync('npm install --save-dev vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed successfully');
  } catch (installError) {
    console.error('Failed to install Vercel CLI:', installError.message);
    process.exit(1);
  }
}

// Check for .env file
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('⚠️ No .env file found, but .env.example exists.');
  console.log('You might need to create a .env file with your environment variables.');
}

// Check for vercel.json
const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
if (!fs.existsSync(vercelConfigPath)) {
  console.error('❌ vercel.json not found. Make sure you have created the configuration file.');
  process.exit(1);
}

console.log('✅ vercel.json found');

// Prompt for deployment type
rl.question('Do you want to deploy to production? (y/N): ', (answer) => {
  const isProduction = answer.toLowerCase() === 'y';
  
  try {
    if (isProduction) {
      console.log('\n📤 Deploying to production...');
      execSync('npx vercel --prod', { stdio: 'inherit' });
    } else {
      console.log('\n📤 Deploying to preview environment...');
      execSync('npx vercel', { stdio: 'inherit' });
    }
    
    console.log('\n✅ Deployment completed successfully!');
    console.log('\nYou can find your deployment in the Vercel dashboard.');
    
    if (!isProduction) {
      console.log('\nTo deploy to production later, run:');
      console.log('npx vercel --prod');
    }
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    console.log('\nCheck the error message above and try again.');
  }
  
  rl.close();
});