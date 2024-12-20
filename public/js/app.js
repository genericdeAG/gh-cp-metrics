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

let currentChart = null;

async function fetchMetrics() {
    try {
        const dateRange = getDateRangeForTimeFrame();
        const since = dateRange.start.toISOString();
        const until = dateRange.end.toISOString();
        
        // Fetch org metrics and usage data
        const orgMetrics = await fetch(`/api/copilot/metrics/org?org=${selectedOrg}&since=${since}&until=${until}&per_page=28`).then(res => res.json());
        const orgUsage = await fetch(`/api/org/usage/${selectedOrg}?since=${since}&until=${until}`).then(res => res.json());
        
        // Conditionally fetch enterprise metrics based on toggle state
        const showEnterprise = document.getElementById('enterprise-toggle').getAttribute('aria-checked') === 'true';
        let enterpriseMetrics = null;
        
        if (showEnterprise) {
            enterpriseMetrics = await fetch(`/api/copilot/metrics/enterprise?since=${since}&until=${until}&per_page=28`).then(res => res.json());
        }

        // Update usage info with suggestions and acceptances
        updateUsageInfo(orgUsage);
        
        // Create sections based on toggle state
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
        
        if (showEnterprise && enterpriseMetrics) {
            const enterpriseSection = createSection('Enterprise Metrics', enterpriseMetrics);
            container.appendChild(enterpriseSection);
        }
        
        const orgSection = createSection('Organization Metrics', orgMetrics);
        container.appendChild(orgSection);

        // Create the suggestions/acceptances chart
        createSuggestionsChart(orgUsage);
        
        // Create the existing metrics charts
        createCharts(enterpriseMetrics, orgMetrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4';
        errorDiv.textContent = `Error: ${error.message}`;
        const mainElement = document.querySelector('main');
        if (mainElement) {
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
    section.className = 'bg-white rounded-lg shadow-lg';
    
    // Calculate max values
    const maxActiveUsers = Math.max(...metricsData.map(m => m.total_active_users));
    const maxEngagedUsers = Math.max(...metricsData.map(m => m.total_engaged_users));
    const maxChatUsers = Math.max(...metricsData.map(m => m.copilot_ide_chat.total_engaged_users || 0));

    // Aggregate IDE completion data across all days
    const aggregatedEditors = aggregateEditorData(metricsData);
    // Aggregate languages data across all days
    const aggregatedLanguages = metricsData.reduce((acc, day) => {
        const languages = day.copilot_ide_code_completions?.languages || [];
        languages.forEach(lang => {
            if (!acc.has(lang.name)) {
                acc.set(lang.name, {
                    name: lang.name,
                    max_engaged_users: lang.total_engaged_users || 0
                });
            } else {
                const langData = acc.get(lang.name);
                langData.max_engaged_users = Math.max(langData.max_engaged_users, lang.total_engaged_users || 0);
            }
        });

        return acc;
    }, new Map());
    
    section.innerHTML = `
        <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-xl font-semibold text-gray-800">${title}</h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <!-- Left Column: IDE Completions and Languages -->
            <div class="space-y-6">
                <!-- IDE Completions -->
                <div class="bg-white p-4 rounded-lg border border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-700 mb-4">IDE Completions by Editor</h3>
                    <div class="space-y-4">
                        ${createEditorCards(aggregatedEditors)}
                    </div>
                </div>

                <!-- Language Stats -->
                <div class="bg-white p-4 rounded-lg border border-gray-100">
                    <h3 class="text-lg font-semibold text-gray-700 mb-4">Languages Used</h3>
                    <div class="grid grid-cols-2 gap-3">
                        ${createLanguageCards(Array.from(aggregatedLanguages.values()))}
                    </div>
                </div>
            </div>

            <!-- Right Column: Chart and User Numbers -->
            <div class="space-y-6">
                <!-- User Metrics Cards -->
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <p class="text-sm font-medium text-blue-600">Active Users</p>
                        <p class="text-2xl font-bold text-blue-700">${maxActiveUsers}</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg">
                        <p class="text-sm font-medium text-green-600">Engaged Users</p>
                        <p class="text-2xl font-bold text-green-700">${maxEngagedUsers}</p>
                    </div>
                    <div class="bg-purple-50 p-4 rounded-lg">
                        <p class="text-sm font-medium text-purple-600">Chat Users</p>
                        <p class="text-2xl font-bold text-purple-700">${maxChatUsers}</p>
                    </div>
                </div>

                <!-- Chart -->
                <div class="bg-white rounded-lg border border-gray-100">
                    <canvas id="${title.toLowerCase().replace(/\s+/g, '-')}-chart"></canvas>
                </div>
            </div>
        </div>
    `;

    return section;
}

function createEditorCards(editors) {
    return editors.map(editor => `
        <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex justify-between items-start">
                <h4 class="font-semibold text-gray-800">${editor.name}</h4>
                <span class="text-sm font-medium text-gray-600">${editor.total_engaged_users || 0} users</span>
            </div>
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
    return languages
        .sort((a, b) => b.max_engaged_users - a.max_engaged_users)
        .slice(0, 6)
        .map(lang => `
            <div class="bg-indigo-50 p-3 rounded-lg">
                <div class="flex justify-between items-center">
                    <h4 class="font-medium text-indigo-800">${lang.name}</h4>
                    <span class="text-sm font-medium text-indigo-600">${lang.max_engaged_users}</span>
                </div>
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

let selectedTimeFrame = 'letzte-30-tage';
let customStartDate = null;
let customEndDate = null;

function createTimeFrameSelector() {
    const container = document.createElement('div');
    container.className = 'mb-4';
    container.innerHTML = `
        <div class="flex flex-col mr-4">
            <select id="timeframe-selector" class="form-select rounded-lg border-gray-300">
                <option value="gestern">Gestern</option>
                <option value="diese-woche">Diese Woche</option>
                <option value="letzte-woche">Letzte Woche</option>
                <option value="letzte-7-tage">Letzte 7 Tage</option>
                <option value="letzte-14-tage">Letzte 14 Tage</option>
                <option value="letzte-28-tage" selected>Letzte 28 Tage (Max.)</option>
                <option value="benutzerdefiniert">Benutzerdefiniert</option>
            </select>
            <div id="custom-date-picker" class="hidden">
                <div class="flex space-x-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Startdatum</label>
                        <input type="date" id="start-date" class="mt-1 form-input rounded-md border-gray-300">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Enddatum</label>
                        <input type="date" id="end-date" class="mt-1 form-input rounded-md border-gray-300">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    container.querySelector('#timeframe-selector').addEventListener('change', handleTimeFrameChange);
    container.querySelector('#start-date').addEventListener('change', handleCustomDateChange);
    container.querySelector('#end-date').addEventListener('change', handleCustomDateChange);

    return container;
}

function handleTimeFrameChange(event) {
    selectedTimeFrame = event.target.value;
    const customDatePicker = document.getElementById('custom-date-picker');
    
    if (selectedTimeFrame === 'benutzerdefiniert') {
        customDatePicker.classList.remove('hidden');
    } else {
        customDatePicker.classList.add('hidden');
        fetchMetrics();
    }
}

function handleCustomDateChange() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (startDate && endDate) {
        customStartDate = startDate;
        customEndDate = endDate;
        fetchMetrics();
    }
}

function getDateRangeForTimeFrame() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate the earliest allowed date (28 days ago from now)
    const minDate = new Date(now);
    minDate.setDate(now.getDate() - 27);
    
    let start, end = now;
    
    switch (selectedTimeFrame) {
        case 'gestern':
            start = new Date(today);
            start.setDate(today.getDate() - 1);
            end = today;
            break;
        case 'diese-woche':
            start = new Date(today);
            // Convert Sunday (0) to 7, otherwise subtract 1 to make Monday (1) the start
            const dayOfWeek = today.getDay() || 7;
            start.setDate(today.getDate() - (dayOfWeek - 1));
            start = start < minDate ? minDate : start;
            break;
        case 'letzte-woche':
            start = new Date(today);
            const lastWeekDay = today.getDay() || 7;
            start.setDate(today.getDate() - (lastWeekDay - 1) - 7); // Go back 7 more days for last week
            end = new Date(today);
            end.setDate(today.getDate() - (lastWeekDay));
            start = start < minDate ? minDate : start;
            break;
        case 'letzte-7-tage':
            start = new Date(today);
            start.setDate(today.getDate() - 7);
            start = start < minDate ? minDate : start;
            break;
        case 'letzte-14-tage':
            start = new Date(today);
            start.setDate(today.getDate() - 14);
            start = start < minDate ? minDate : start;
            break;
        case 'letzte-28-tage':
            start = minDate;
            break;
        case 'benutzerdefiniert':
            if (customStartDate && customEndDate) {
                start = new Date(customStartDate);
                end = new Date(customEndDate);
                
                // Ensure start date isn't more than 28 days ago
                start = start < minDate ? minDate : start;
                
                // Ensure end date isn't before start date
                if (end < start) {
                    end = now;
                }
            } else {
                start = minDate;
            }
            break;
        default:
            start = minDate;
    }
    
    // Set the time of the dates to match the current time
    // This ensures we get the most recent data possible
    start.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    end.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    
    return { start, end };
}

function initialize() {
    // Add the time frame selector at the top of the page
    const mainElement = document.querySelector('main');
    const orgSelector = document.getElementById('org-selector');
    if (mainElement && orgSelector) {
        const timeFrameSelector = createTimeFrameSelector();
        orgSelector.parentNode.insertBefore(timeFrameSelector, orgSelector);
    }
    
    loadOrganizations();
    
    // Add event listener for organization selection
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

function aggregateEditorData(metricsData) {
    const editorMap = new Map();

    metricsData.forEach(dayData => {
        const editors = dayData.copilot_ide_code_completions?.editors || [];
        editors.forEach(editor => {
            if (!editorMap.has(editor.name)) {
                editorMap.set(editor.name, {
                    name: editor.name,
                    total_engaged_users: editor.total_engaged_users || 0,
                    models: new Map()
                });
            }

            const editorData = editorMap.get(editor.name);
            editorData.total_engaged_users = Math.max(editorData.total_engaged_users, editor.total_engaged_users || 0);

            (editor.models || []).forEach(model => {
                if (!editorData.models.has(model.name)) {
                    editorData.models.set(model.name, {
                        name: model.name,
                        total_engaged_users: 0,
                        languages: new Map(),
                        is_custom_model: model.is_custom_model
                    });
                }

                const modelData = editorData.models.get(model.name);
                modelData.total_engaged_users = Math.max(modelData.total_engaged_users, model.total_engaged_users || 0);

                (model.languages || []).forEach(lang => {
                    if (!modelData.languages.has(lang.name)) {
                        modelData.languages.set(lang.name, {
                            name: lang.name,
                            total_engaged_users: 0,
                            total_code_acceptances: 0,
                            total_code_suggestions: 0,
                            total_code_lines_accepted: 0,
                            total_code_lines_suggested: 0
                        });
                    }

                    const langData = modelData.languages.get(lang.name);
                    langData.total_engaged_users = Math.max(langData.total_engaged_users, lang.total_engaged_users || 0);
                    langData.total_code_acceptances += lang.total_code_acceptances || 0;
                    langData.total_code_suggestions += lang.total_code_suggestions || 0;
                    langData.total_code_lines_accepted += lang.total_code_lines_accepted || 0;
                    langData.total_code_lines_suggested += lang.total_code_lines_suggested || 0;
                });
            });
        });
    });

    // Convert the Map back to the original structure
    return Array.from(editorMap.values()).map(editor => ({
        ...editor,
        models: Array.from(editor.models.values()).map(model => ({
            ...model,
            languages: Array.from(model.languages.values())
        }))
    }));
}

function updateUsageInfo(usageData) {
    const usageInfo = document.getElementById('usageInfo');
    if (!usageData || !Array.isArray(usageData)) {
        usageInfo.innerHTML = '<p class="text-red-500">Error loading usage data</p>';
        return;
    }

    // Aggregate data across all days
    const aggregatedData = usageData.reduce((acc, day) => ({
        totalSuggestions: acc.totalSuggestions + day.total_suggestions_count,
        totalAcceptances: acc.totalAcceptances + day.total_acceptances_count,
        totalLinesSuggested: acc.totalLinesSuggested + day.total_lines_suggested,
        totalLinesAccepted: acc.totalLinesAccepted + day.total_lines_accepted
    }), {
        totalSuggestions: 0,
        totalAcceptances: 0,
        totalLinesSuggested: 0,
        totalLinesAccepted: 0
    });

    const suggestionAcceptanceRate = aggregatedData.totalSuggestions > 0 
        ? ((aggregatedData.totalAcceptances / aggregatedData.totalSuggestions) * 100).toFixed(1) 
        : 0;

    const lineAcceptanceRate = aggregatedData.totalLinesSuggested > 0
        ? ((aggregatedData.totalLinesAccepted / aggregatedData.totalLinesSuggested) * 100).toFixed(1)
        : 0;

    usageInfo.innerHTML = `
        <div class="space-y-6">
            <!-- Suggestions Metrics -->
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Suggestions Metrics</h3>
                <div class="grid grid-cols-3 gap-4">
                    <div class="p-4 bg-blue-50 rounded-lg">
                        <p class="text-sm font-medium text-blue-600">Total Suggestions</p>
                        <p class="text-2xl font-bold text-blue-700">${aggregatedData.totalSuggestions.toLocaleString()}</p>
                    </div>
                    <div class="p-4 bg-blue-50 rounded-lg">
                        <p class="text-sm font-medium text-blue-600">Total Acceptances</p>
                        <p class="text-2xl font-bold text-blue-700">${aggregatedData.totalAcceptances.toLocaleString()}</p>
                    </div>
                    <div class="p-4 bg-blue-50 rounded-lg">
                        <p class="text-sm font-medium text-blue-600">Acceptance Rate</p>
                        <p class="text-2xl font-bold text-blue-700">${suggestionAcceptanceRate}%</p>
                    </div>
                </div>
            </div>

            <!-- Lines Metrics -->
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 class="text-lg font-semibold text-gray-700 mb-4">Lines Metrics</h3>
                <div class="grid grid-cols-3 gap-4">
                    <div class="p-4 bg-orange-50 rounded-lg">
                        <p class="text-sm font-medium text-orange-600">Lines Suggested</p>
                        <p class="text-2xl font-bold text-orange-700">${aggregatedData.totalLinesSuggested.toLocaleString()}</p>
                    </div>
                    <div class="p-4 bg-orange-50 rounded-lg">
                        <p class="text-sm font-medium text-orange-600">Lines Accepted</p>
                        <p class="text-2xl font-bold text-orange-700">${aggregatedData.totalLinesAccepted.toLocaleString()}</p>
                    </div>
                    <div class="p-4 bg-orange-50 rounded-lg">
                        <p class="text-sm font-medium text-orange-600">Acceptance Rate</p>
                        <p class="text-2xl font-bold text-orange-700">${lineAcceptanceRate}%</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createSuggestionsChart(usageData) {
    const canvas = document.getElementById('usageChart');
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }

    if (!Array.isArray(usageData)) {
        console.error('Usage data is not an array');
        return;
    }

    // Prepare data for the chart
    const labels = usageData.map(day => day.day);
    const suggestions = usageData.map(day => day.total_suggestions_count);
    const acceptances = usageData.map(day => day.total_acceptances_count);
    const linesSuggested = usageData.map(day => day.total_lines_suggested);
    const linesAccepted = usageData.map(day => day.total_lines_accepted);

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Suggestions',
                    data: suggestions,
                    borderColor: '#93C5FD',
                    backgroundColor: '#93C5FD20',
                    fill: true
                },
                {
                    label: 'Acceptances',
                    data: acceptances,
                    borderColor: '#1D4ED8',
                    backgroundColor: '#1D4ED820',
                    fill: true
                },
                {
                    label: 'Lines Suggested',
                    data: linesSuggested,
                    borderColor: '#FCD34D',
                    backgroundColor: '#FCD34D20',
                    fill: true
                },
                {
                    label: 'Lines Accepted',
                    data: linesAccepted,
                    borderColor: '#F97316',
                    backgroundColor: '#F9731620',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Copilot Usage Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

initialize();
