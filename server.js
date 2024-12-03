import 'dotenv/config';
import express from 'express';
import { Octokit } from 'octokit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

app.use(express.static('public'));


app.get('/api/organizations', async (req, res) => {
    try {
        const response = await octokit.request('GET /user/orgs', {
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        const orgs = response.data.map(org => ({
            login: org.login,
            name: org.name || org.login,
            id: org.id
        }));

        res.json(orgs);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

app.get('/api/org/usage', async (req, res) => {
    try {
        const response = await octokit.request('GET /orgs/{org}/copilot/usage', {
            org: process.env.ORG_NAME_2,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('GitHub API Error:', {
            response: error.response?.data,
            endpoint: 'GET /orgs/{org}/copilot/usage'
        });
        res.status(500).json({ error: `Status ${error.response?.status || 'Unknown'} - ${error.message}` });
    }
});

app.get('/api/enterprise/usage', async (req, res) => {
    try {
        const response = await octokit.request('GET /enterprises/{enterprise}/copilot/usage', {
            enterprise: process.env.ENTERPRISE_NAME,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('GitHub API Error:', {
            response: error.response?.data,
            endpoint: 'GET /enterprises/{enterprise}/copilot/usage'
        });
        res.status(500).json({ error: `Status ${error.response?.status || 'Unknown'} - ${error.message}` });
    }
});

app.get('/api/copilot/metrics/enterprise', async (req, res) => {
    try {
        console.log(`Fetching metrics for enterprise: ${process.env.ENTERPRISE_NAME}`);

        const response = await octokit.request('GET /enterprises/{enterprise}/copilot/metrics', {
            enterprise: process.env.ENTERPRISE_NAME,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Enterprise Metrics Error:', {
            message: error.message,
            status: error.status,
            response: error.response?.data
        });
        res.status(500).json({ 
            error: error.message,
            enterprise: process.env.ENTERPRISE_NAME,
            documentation_url: 'https://docs.github.com/rest/copilot/copilot-business#get-copilot-metrics-for-an-enterprise'
        });
    }
});

app.get('/api/copilot/metrics/org', async (req, res) => {
    try {
        const selectedOrg = req.query.org || process.env.ORG_NAME_1; // Use query param or fallback to default
        console.log(`Fetching metrics for organization: ${selectedOrg}`);

        const response = await octokit.request('GET /orgs/{org}/copilot/metrics', {
            org: selectedOrg,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        // console.error('Organization Metrics Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
