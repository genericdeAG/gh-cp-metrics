# GitHub Copilot Usage Metrics Analyzer

A web application to analyze and visualize GitHub Copilot usage metrics for your organization.

## Features

- View total active seats and billing period information
- Monitor seat assignments and last activity dates
- Visualize seat allocation with interactive charts
- Real-time data fetching from GitHub API

## Setup

### Option 1: Local Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.template`:
   ```
   GITHUB_TOKEN=your_github_token_here
   ORG_NAME=your_organization_name
   ```

   To get your GitHub token:
   1. Go to GitHub Settings > Developer settings > Personal access tokens
   2. Generate a new token with `read:org` and `copilot` scopes

4. Start the server:
   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser

### Option 2: Docker Setup

1. Build the Docker image:
   ```bash
   docker build -t gh-cp-metrics .
   ```

2. Run the container:
   
   Either use environment variables directly:
   ```bash
   docker run -p 3000:3000 \
     -e GITHUB_TOKEN=your_github_token_here \
     -e ENTERPRISE_NAME=your_enterprise_name \
     gh-cp-metrics
   ```

   Or use your local `.env` file:
   ```bash
   docker run -p 3000:3000 --env-file .env gh-cp-metrics
   ```

3. Open `http://localhost:3000` in your browser

## Technology Stack

- Backend: Node.js with Express
- Frontend: HTML, JavaScript, Tailwind CSS
- Data Visualization: Chart.js
- API: GitHub REST API
- Containerization: Docker

## API Documentation

This application uses the GitHub Copilot API. For more information, see:
https://docs.github.com/en/rest/copilot/copilot-usage
