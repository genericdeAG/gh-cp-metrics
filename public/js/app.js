async function fetchData(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

function displayUsageInfo(data) {
    const usageInfo = document.getElementById('usageInfo');
    if (!data) {
        usageInfo.innerHTML = '<p class="text-red-500">Error loading usage data</p>';
        return;
    }

    usageInfo.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-gray-50 rounded">
                <p class="text-gray-600">Total Usage Minutes</p>
                <p class="text-2xl font-bold">${data.total_minutes || 0}</p>
            </div>
            <div class="p-4 bg-gray-50 rounded">
                <p class="text-gray-600">Breakdown</p>
                <p class="text-sm">Lines Suggested: ${data.breakdown?.lines_suggested || 0}</p>
                <p class="text-sm">Lines Accepted: ${data.breakdown?.lines_accepted || 0}</p>
            </div>
        </div>
    `;
}

function displaySeatInfo(data) {
    const seatInfo = document.getElementById('seatInfo');
    if (!data) {
        seatInfo.innerHTML = '<p class="text-red-500">Error loading seat data</p>';
        return;
    }

    const seats = data.seats || [];
    seatInfo.innerHTML = `
        <div class="space-y-2">
            <p class="font-semibold">Active Users: ${seats.length}</p>
            <div class="max-h-48 overflow-y-auto">
                ${seats.map(seat => `
                    <div class="p-2 bg-gray-50 rounded mb-2">
                        <p class="text-sm">${seat.user?.login || 'Unknown User'}</p>
                        <p class="text-xs text-gray-500">Last Activity: ${seat.last_activity_at ? new Date(seat.last_activity_at).toLocaleDateString() : 'N/A'}</p>
                        <p class="text-xs text-gray-500">Status: ${seat.assignment_status || 'Unknown'}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function createUsageChart(usageData) {
    const ctx = document.getElementById('usageChart').getContext('2d');
    
    const suggestedLines = usageData?.breakdown?.lines_suggested || 0;
    const acceptedLines = usageData?.breakdown?.lines_accepted || 0;
    const acceptanceRate = suggestedLines > 0 ? (acceptedLines / suggestedLines * 100).toFixed(1) : 0;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Lines Suggested', 'Lines Accepted', 'Acceptance Rate (%)'],
            datasets: [{
                data: [suggestedLines, acceptedLines, acceptanceRate],
                backgroundColor: ['#4F46E5', '#10B981', '#F59E0B'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Copilot Usage Statistics'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function fetchMetrics() {
    try {
        const [enterpriseMetrics, orgMetrics] = await Promise.all([
            fetch('/api/copilot/metrics/enterprise').then(res => res.json()),
            fetch('/api/copilot/metrics/org').then(res => res.json())
        ]);
        
        displayMetrics(enterpriseMetrics, orgMetrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
    }
}

function displayMetrics(enterpriseMetrics, orgMetrics) {
    const metricsContainer = document.getElementById('metrics-container');
    if (!metricsContainer) {
        const container = document.createElement('div');
        container.id = 'metrics-container';
        container.className = 'mt-8 grid grid-cols-1 md:grid-cols-2 gap-6';
        document.querySelector('main').appendChild(container);
    }

    // Display enterprise metrics
    if (enterpriseMetrics && enterpriseMetrics.length > 0) {
        const latestMetrics = enterpriseMetrics[0];
        displayMetricsSection('Enterprise Metrics', latestMetrics);
    }

    // Display org metrics
    if (orgMetrics && orgMetrics.length > 0) {
        const latestMetrics = orgMetrics[0];
        displayMetricsSection('Organization Metrics', latestMetrics);
    }
}

function displayMetricsSection(title, metrics) {
    const container = document.getElementById('metrics-container');
    const section = document.createElement('div');
    section.className = 'bg-white p-6 rounded-lg shadow-lg';
    
    section.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">${title}</h2>
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 p-4 rounded">
                    <h3 class="font-semibold">Active Users</h3>
                    <p class="text-2xl">${metrics.total_active_users}</p>
                </div>
                <div class="bg-gray-50 p-4 rounded">
                    <h3 class="font-semibold">Engaged Users</h3>
                    <p class="text-2xl">${metrics.total_engaged_users}</p>
                </div>
            </div>
            
            ${createIDEMetricsHTML(metrics.copilot_ide_code_completions)}
            ${createChatMetricsHTML(metrics.copilot_ide_chat, metrics.copilot_dotcom_chat)}
            ${createPRMetricsHTML(metrics.copilot_dotcom_pull_requests)}
        </div>
    `;
    
    container.appendChild(section);
}

function createIDEMetricsHTML(ideMetrics) {
    if (!ideMetrics) return '';
    
    const languageStats = ideMetrics.languages.map(lang => `
        <div class="bg-blue-50 p-3 rounded">
            <h4 class="font-medium">${lang.name}</h4>
            <p>${lang.total_engaged_users} users</p>
        </div>
    `).join('');

    return `
        <div class="mt-6">
            <h3 class="text-xl font-semibold mb-3">IDE Completions</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                ${languageStats}
            </div>
        </div>
    `;
}

function createChatMetricsHTML(ideChat, dotcomChat) {
    if (!ideChat && !dotcomChat) return '';
    
    return `
        <div class="mt-6">
            <h3 class="text-xl font-semibold mb-3">Chat Usage</h3>
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-green-50 p-4 rounded">
                    <h4 class="font-medium">IDE Chat</h4>
                    <p>${ideChat?.total_engaged_users || 0} users</p>
                </div>
                <div class="bg-green-50 p-4 rounded">
                    <h4 class="font-medium">GitHub.com Chat</h4>
                    <p>${dotcomChat?.total_engaged_users || 0} users</p>
                </div>
            </div>
        </div>
    `;
}

function createPRMetricsHTML(prMetrics) {
    if (!prMetrics) return '';
    
    const repoStats = prMetrics.repositories.map(repo => `
        <div class="bg-purple-50 p-3 rounded">
            <h4 class="font-medium">${repo.name}</h4>
            <p>${repo.total_engaged_users} users</p>
            <p>${repo.models[0]?.total_pr_summaries_created || 0} PR summaries</p>
        </div>
    `).join('');

    return `
        <div class="mt-6">
            <h3 class="text-xl font-semibold mb-3">Pull Request Activity</h3>
            <div class="grid grid-cols-2 gap-3">
                ${repoStats}
            </div>
        </div>
    `;
}

async function initialize() {
    const usageData = await fetchData('/api/enterprise/usage');

    displayUsageInfo(usageData);
    createUsageChart(usageData);
    fetchMetrics();
}

initialize();
