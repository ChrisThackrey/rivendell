# Deploying to Vercel

This guide explains how to deploy the Rivendell application to Vercel.

## Prerequisites

- A Vercel account
- Access to the project's GitHub repository
- Required environment variables (see `environment.md`)

## Option 1: Deploying with the Vercel Dashboard (Recommended for First Deployment)

1. **Log in to Vercel**
   - Go to [vercel.com](https://vercel.com) and log in to your account

2. **Import the GitHub Repository**
   - Click on "Add New..." → "Project"
   - Connect to GitHub if you haven't already
   - Select the Rivendell repository

3. **Configure Project**
   - Vercel should automatically detect the project as a Next.js application
   - Keep the default settings:
     - Framework Preset: Next.js
     - Build Command: `npm run build`
     - Output Directory: `.next`
     - Install Command: `npm install`

4. **Environment Variables**
   - Add all required environment variables listed in `environment.md`
   - Make sure to set the correct values for each environment (Production, Preview, Development)

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application

## Option 2: Deploying with the CLI

1. **Install Dependencies**
   - Make sure you have the required packages installed:
   ```
   npm install --save-dev vercel
   npm install @vercel/analytics
   ```

2. **Login to Vercel CLI**
   ```
   npx vercel login
   ```

3. **Run the Deployment Script**
   ```
   npm run deploy
   ```
   - Answer the prompts to complete the deployment
   - Select whether to deploy to production or a preview environment

4. **Verify Deployment**
   - The CLI will output a URL where your application is deployed
   - Visit the URL to confirm the deployment was successful

## Continuous Deployment

Once you've completed the initial deployment, Vercel will automatically deploy new versions of your application when you push changes to your GitHub repository.

1. **Production Deployments**
   - By default, changes to the `main` branch will deploy to production
   - You can change this in the Vercel dashboard under Project Settings → Git

2. **Preview Deployments**
   - Vercel will create preview deployments for pull requests
   - This allows you to test changes before merging to the main branch

## Troubleshooting

If you encounter issues during deployment:

1. **Check Build Logs**
   - Review the build logs in the Vercel dashboard
   - Look for error messages that indicate what went wrong

2. **Verify Environment Variables**
   - Make sure all required environment variables are set correctly
   - Check for typos or missing values

3. **Local Verification**
   - Run `npm run build` locally to verify the build process works
   - This can help identify issues before attempting deployment

4. **Sentry Issues**
   - If Sentry integration causes problems, you can temporarily disable it by modifying `next.config.ts`
   - See comments in that file for instructions

## Resources

- [Vercel Documentation for Next.js](https://vercel.com/docs/frameworks/nextjs)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)