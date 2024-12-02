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

let selectedOrg = '';
async function loadOrganizations() {
    const orgs = await fetchData('/api/organizations');
    if (!orgs) return;

    const selector = document.getElementById('org-selector');
    orgs.forEach(org => {
        const option = document.createElement('option');
        option.value = org.login;
        option.textContent = org.name;
        selector.appendChild(option);
    });

    // Select the first organization by default
    if (orgs.length > 0) {
        selector.value = orgs[0].login;
        selectedOrg = orgs[0].login;
        fetchMetrics();
    }
}

async function fetchMetrics() {
    try {
        // Always fetch org metrics
        const orgMetrics = await fetch(`/api/copilot/metrics/org?org=${selectedOrg}`).then(res => res.json());
        
        // Conditionally fetch enterprise metrics based on toggle state
        const showEnterprise = document.getElementById('enterprise-toggle').getAttribute('aria-checked') === 'true';
        let enterpriseMetrics = null;
        
        if (showEnterprise) {
            enterpriseMetrics = await fetch(`/api/copilot/metrics/enterprise`).then(res => res.json());
        }
        
        const mainElement = document.querySelector('main');
        if (!mainElement) {
            throw new Error('Main element not found in the document');
        }

        // Clear previous metrics
        let container = document.getElementById('metrics-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'metrics-container';
            container.className = 'mt-8 space-y-8';
            mainElement.appendChild(container);
        }
        container.innerHTML = '';
        
        // Create sections based on toggle state
        if (showEnterprise && enterpriseMetrics) {
            const enterpriseSection = createSection('Enterprise Metrics', enterpriseMetrics);
            container.appendChild(enterpriseSection);
        }
        
        const orgSection = createSection('Organization Metrics', orgMetrics);
        container.appendChild(orgSection);

        // Create charts
        createCharts(enterpriseMetrics, orgMetrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        const mainElement = document.querySelector('main');
        if (mainElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4';
            errorDiv.textContent = `Error: ${error.message}`;
            mainElement.appendChild(errorDiv);
        }
    }
}

function createMetricsContainer() {
    const container = document.createElement('div');
    container.id = 'metrics-container';
    container.className = 'mt-8 space-y-8';
    document.querySelector('main').appendChild(container);
    return container;
}

function createSection(title, metricsData) {
    const section = document.createElement('div');
    section.className = 'bg-white p-6 rounded-lg shadow-lg';
    
    const latestMetrics = metricsData[metricsData.length - 1];
    
    section.innerHTML = `
        <h2 class="text-2xl font-bold mb-6">${title}</h2>
        
        <!-- Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-blue-50 p-4 rounded-lg">
                <h3 class="font-semibold text-blue-800">Active Users</h3>
                <p class="text-3xl font-bold text-blue-600">${latestMetrics.total_active_users}</p>
            </div>
            <div class="bg-green-50 p-4 rounded-lg">
                <h3 class="font-semibold text-green-800">Engaged Users</h3>
                <p class="text-3xl font-bold text-green-600">${latestMetrics.total_engaged_users}</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-lg">
                <h3 class="font-semibold text-purple-800">IDE Chat Users</h3>
                <p class="text-3xl font-bold text-purple-600">${latestMetrics.copilot_ide_chat.total_engaged_users || 0}</p>
            </div>
        </div>

        <!-- IDE Completions -->
        <div class="mt-8">
            <h3 class="text-xl font-semibold mb-4">IDE Completions by Editor</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${createEditorCards(latestMetrics.copilot_ide_code_completions?.editors || [])}
            </div>
        </div>

        <!-- Language Stats -->
        <div class="mt-8">
            <h3 class="text-xl font-semibold mb-4">Language Usage</h3>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                ${createLanguageCards(latestMetrics.copilot_ide_code_completions?.languages || [])}
            </div>
        </div>

        <!-- Charts Container -->
        <div class="mt-8">
            <canvas id="${title.toLowerCase().replace(/\s+/g, '-')}-chart" class="w-full"></canvas>
        </div>
    `;

    return section;
}

function createEditorCards(editors) {
    return editors.map(editor => `
        <div class="bg-gray-50 p-4 rounded-lg">
            <h4 class="font-semibold text-gray-800">${editor.name}</h4>
            <p class="text-2xl font-bold text-gray-600">${editor.total_engaged_users || 0} users</p>
            ${createModelStats(editor.models)}
        </div>
    `).join('');
}

function createModelStats(models) {
    if (!models || !models.length) return '';
    
    return models.map(model => {
        const languages = model.languages || [];
        const totalAcceptances = languages.reduce((sum, lang) => sum + (lang.total_code_acceptances || 0), 0);
        const totalSuggestions = languages.reduce((sum, lang) => sum + (lang.total_code_suggestions || 0), 0);
        
        return `
            <div class="mt-2 text-sm">
                <p>Acceptances: ${totalAcceptances}</p>
                <p>Suggestions: ${totalSuggestions}</p>
                ${model.total_engaged_users ? `<p>Users: ${model.total_engaged_users}</p>` : ''}
            </div>
        `;
    }).join('');
}

function createLanguageCards(languages) {
    return languages.map(lang => `
        <div class="bg-indigo-50 p-3 rounded-lg">
            <h4 class="font-medium text-indigo-800">${lang.name}</h4>
            <p class="text-xl font-semibold text-indigo-600">${lang.total_engaged_users} users</p>
        </div>
    `).join('');
}

function createCharts(enterpriseMetrics, orgMetrics) {
    // Clear previous charts
    const chartContainer = document.getElementById('usageChart');
    chartContainer.innerHTML = '';
    
    // Create organization chart
    createTimeSeriesChart('organization-metrics-chart', orgMetrics, 'Organization Usage Over Time');
    
    // Conditionally create enterprise chart
    if (enterpriseMetrics) {
        createTimeSeriesChart('enterprise-metrics-chart', enterpriseMetrics, 'Enterprise Usage Over Time');
    }
}

function createTimeSeriesChart(canvasId, metricsData, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    const dates = metricsData.map(m => m.date);
    const activeUsers = metricsData.map(m => m.total_active_users);
    const engagedUsers = metricsData.map(m => m.total_engaged_users);
    const chatUsers = metricsData.map(m => m.copilot_ide_chat.total_engaged_users || 0);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Active Users',
                    data: activeUsers,
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1
                },
                {
                    label: 'Engaged Users',
                    data: engagedUsers,
                    borderColor: 'rgb(34, 197, 94)',
                    tension: 0.1
                },
                {
                    label: 'Chat Users',
                    data: chatUsers,
                    borderColor: 'rgb(168, 85, 247)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function initialize() {
    loadOrganizations();
    
    // Add event listener for organization selection
    const orgSelector = document.getElementById('org-selector');
    orgSelector.addEventListener('change', (e) => {
        selectedOrg = e.target.value;
        fetchMetrics();
    });

    // Add event listener for the enterprise toggle
    const toggle = document.getElementById('enterprise-toggle');
    let isChecked = false;

    toggle.addEventListener('click', () => {
        isChecked = !isChecked;
        toggle.setAttribute('aria-checked', isChecked);
        
        // Update toggle appearance
        const toggleCircle = toggle.querySelector('span');
        if (isChecked) {
            toggle.classList.remove('bg-gray-200');
            toggle.classList.add('bg-blue-600');
            toggleCircle.classList.remove('translate-x-0');
            toggleCircle.classList.add('translate-x-5');
        } else {
            toggle.classList.add('bg-gray-200');
            toggle.classList.remove('bg-blue-600');
            toggleCircle.classList.add('translate-x-0');
            toggleCircle.classList.remove('translate-x-5');
        }
        
        // Fetch new data
        fetchMetrics();
    });

    // Initial fetch
    fetchMetrics();
}

initialize();
