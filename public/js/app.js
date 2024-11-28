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

async function initialize() {
    const usageData = await fetchData('/api/enterprise/usage');

    displayUsageInfo(usageData);
    createUsageChart(usageData);
}

initialize();
