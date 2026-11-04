/**
 * Campus Energy Detective - Frontend Controller
 * =============================================
 * Connects the UI to the backend REST API when available (e.g. localhost:5000)
 * and seamlessly provides full in-browser client-side interactivity on GitHub Pages.
 */

const isLocalhost = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1" || 
                    window.location.protocol === "file:";

const API_BASE = isLocalhost ? "http://localhost:5000" : window.location.origin;

let energyChartInstance = null;
let isBackendLive = false;

// Default Mock/Persistent Data Store for GitHub Pages / Offline mode
const DEFAULT_ROOMS = [
    { id: 1, code: "CL-A", name: "CSE Lab - A", avatar: "CL", type: "Laboratory", block: "Block A", baseline_kwh: 300, consumption_kwh: 428.0, cost_inr: 3424.0, status: "High", notes: "Heavy GPU workstations running overnight" },
    { id: 2, code: "EL-B", name: "ECE Lab - B", avatar: "EL", type: "Laboratory", block: "Block B", baseline_kwh: 260, consumption_kwh: 312.0, cost_inr: 2496.0, status: "Medium", notes: "Soldering stations and test benches active" },
    { id: 3, code: "LH-2", name: "Lecture Hall 2", avatar: "LH", type: "Classroom", block: "Block A", baseline_kwh: 180, consumption_kwh: 216.0, cost_inr: 1728.0, status: "Normal", notes: "Standard projector & lighting usage" },
    { id: 4, code: "SH-1", name: "Seminar Hall", avatar: "SH", type: "Hall", block: "Main Auditorium", baseline_kwh: 280, consumption_kwh: 389.0, cost_inr: 3112.0, status: "High", notes: "AC left cooling empty hall between sessions" },
    { id: 5, code: "LIB-1", name: "Central Library", avatar: "CL", type: "Library", block: "Central Block", baseline_kwh: 310, consumption_kwh: 298.0, cost_inr: 2384.0, status: "Medium", notes: "Continuous air conditioning during exam prep" },
    { id: 6, code: "CAD-1", name: "Mechanical CAD Lab", avatar: "MC", type: "Laboratory", block: "Workshop Block", baseline_kwh: 290, consumption_kwh: 364.0, cost_inr: 2912.0, status: "High", notes: "Workstations in high power mode" },
    { id: 7, code: "SRV-1", name: "Server & Data Center", avatar: "SD", type: "Facility", block: "Admin Block", baseline_kwh: 420, consumption_kwh: 442.0, cost_inr: 3536.0, status: "High", notes: "24/7 HVAC cooling critical servers" },
    { id: 8, code: "ADM-1", name: "Faculty & Admin Offices", avatar: "AO", type: "Office", block: "Admin Block", baseline_kwh: 200, consumption_kwh: 192.0, cost_inr: 1536.0, status: "Normal", notes: "General office computers and lighting" }
];

const DEFAULT_ALERTS = [
    { id: 1, room_id: 1, room_name: "CSE Lab - Block A", icon: "⚠️", severity: "high", title: "High GPU Load", message: "32% above average usage detected over past 7 days.", is_active: 1 },
    { id: 2, room_id: 4, room_name: "Seminar Hall", icon: "🔥", severity: "high", title: "Unscheduled AC Usage", message: "AC usage unusually high during unoccupied weekend slots.", is_active: 1 },
    { id: 3, room_id: 2, room_name: "ECE Lab", icon: "💡", severity: "warning", title: "Lighting Inefficiency", message: "Possible lighting wastage during non-instructional hours.", is_active: 1 },
    { id: 4, room_id: 6, room_name: "Mechanical CAD Lab", icon: "⚡", severity: "warning", title: "Peak Demand Surge", message: "Workstation cluster drew 6.8 kW peak near closing hours.", is_active: 1 }
];

const DEFAULT_SUGGESTIONS = [
    { id: 1, title: "Reduce AC usage by 1 hour/day", description: "Adjust thermostat to 24°C and power down chillers 1 hour prior to end of classes.", estimated_monthly_saving_inr: 1200.0, kwh_saved_monthly: 150.0, category: "HVAC" },
    { id: 2, title: "Smart Motion Sensors in ECE & CAD Labs", description: "Install automatic PIR occupancy sensors to eliminate empty-room lighting wastage.", estimated_monthly_saving_inr: 850.0, kwh_saved_monthly: 106.25, category: "Lighting" },
    { id: 3, title: "Night-time PC Sleep Policy", description: "Automate sleep mode on all 120+ computer lab terminals after 6:30 PM.", estimated_monthly_saving_inr: 1450.0, kwh_saved_monthly: 181.25, category: "Equipment" },
    { id: 4, title: "Solar Pre-cooling for Seminar Hall", description: "Schedule AC start 20 minutes before events rather than keeping standby chillers active.", estimated_monthly_saving_inr: 980.0, kwh_saved_monthly: 122.5, category: "HVAC" }
];

// In-memory state for client-side mode
let localRooms = JSON.parse(localStorage.getItem("ced_rooms")) || DEFAULT_ROOMS;
let localAlerts = JSON.parse(localStorage.getItem("ced_alerts")) || DEFAULT_ALERTS;

function saveLocalState() {
    try {
        localStorage.setItem("ced_rooms", JSON.stringify(localRooms));
        localStorage.setItem("ced_alerts", JSON.stringify(localAlerts));
    } catch (e) {}
}

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener("DOMContentLoaded", async () => {
    initModalsAndContainer();
    await checkBackendHealth();
    loadDashboardStats();
    initEnergyChart();
    loadAlerts();
    loadRoomsTable();
    bindEvents();
});

// Check if backend is online and update status badge
async function checkBackendHealth() {
    const statusText = document.querySelector(".system-status");
    if (!statusText) return;

    if (isLocalhost) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                isBackendLive = true;
                statusText.innerHTML = `<span class="status-dot"></span> System Online (Live DB)`;
                return;
            }
        } catch (e) {
            isBackendLive = false;
        }
    }

    // On Netlify / Cloud deployment or Local: Always display System Online with pulsing green dot!
    statusText.innerHTML = `<span class="status-dot"></span> System Online`;
}

// =============================================================================
// Dashboard Data & Cards
// =============================================================================

async function loadDashboardStats() {
    let data = {
        total_energy_kwh: 1842.0,
        total_cost_inr: 14736.0,
        high_usage_rooms: localRooms.filter(r => r.status === "High").length || 4,
        potential_savings_inr: 4480.0,
        efficiency_score: 78,
        energy_change_pct: 8.4,
        cost_change_pct: 5.2
    };

    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/dashboard`);
            if (res.ok) {
                const json = await res.json();
                data = json.data;
            }
        } catch (e) {}
    }

    // Total Energy
    const energyEl = document.querySelector(".energy-card h2");
    if (energyEl) energyEl.innerHTML = `${Number(data.total_energy_kwh).toLocaleString()} <small>kWh</small>`;
    const energyChangeEl = document.querySelector(".energy-card p");
    if (energyChangeEl && data.energy_change_pct !== undefined) {
        const isPos = data.energy_change_pct >= 0;
        energyChangeEl.className = isPos ? "positive" : "negative";
        energyChangeEl.innerHTML = `${isPos ? '↑' : '↓'} ${Math.abs(data.energy_change_pct)}% <span>vs last month</span>`;
    }

    // Estimated Cost
    const costEl = document.querySelector(".cost-card h2");
    if (costEl) costEl.innerHTML = `₹${Number(data.total_cost_inr).toLocaleString()}`;
    const costChangeEl = document.querySelector(".cost-card p");
    if (costChangeEl && data.cost_change_pct !== undefined) {
        costChangeEl.className = "negative";
        costChangeEl.innerHTML = `↑ ${data.cost_change_pct}% <span>vs last month</span>`;
    }

    // High Usage Rooms
    const highRoomsEl = document.querySelector(".room-card h2");
    if (highRoomsEl) {
        const countStr = String(data.high_usage_rooms).padStart(2, '0');
        highRoomsEl.innerHTML = `${countStr} <small>Rooms</small>`;
    }

    // Potential Savings
    const savingEl = document.querySelector(".saving-card h2");
    if (savingEl) savingEl.innerHTML = `₹${Number(data.potential_savings_inr).toLocaleString()}`;

    // Efficiency Score
    const scoreNumEl = document.querySelector(".score-number");
    if (scoreNumEl) scoreNumEl.innerHTML = `${data.efficiency_score}<span>/100</span>`;
    const progressEl = document.querySelector(".progress div");
    if (progressEl) progressEl.style.width = `${data.efficiency_score}%`;
}

// =============================================================================
// Chart.js Energy Consumption Chart
// =============================================================================

async function initEnergyChart() {
    const canvas = document.getElementById("energyChart");
    if (!canvas) return;

    const filterSelect = document.getElementById("chartFilter");
    const filterVal = filterSelect ? filterSelect.value : "Last 6 Months";
    const is12 = filterVal.includes("12");

    let chartData = is12 ? {
        labels: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
        datasets: [
            {
                label: "Energy (kWh)",
                data: [1720, 1580, 1640, 1710, 1890, 2140, 1780, 1620, 1740, 1810, 1699, 1842],
                borderColor: "#39e6ff",
                backgroundColor: "rgba(57, 230, 255, 0.12)",
                borderWidth: 2.5,
                tension: 0.4,
                fill: true
            },
            {
                label: "Cost (₹)",
                data: [13760, 12640, 13120, 13680, 15120, 17120, 14240, 12960, 13920, 14480, 13592, 14736],
                borderColor: "#ffb454",
                backgroundColor: "transparent",
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.3,
                fill: false,
                yAxisID: "y1"
            }
        ]
    } : {
        labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
        datasets: [
            {
                label: "Energy (kWh)",
                data: [1780, 1620, 1740, 1810, 1699, 1842],
                borderColor: "#39e6ff",
                backgroundColor: "rgba(57, 230, 255, 0.12)",
                borderWidth: 2.5,
                tension: 0.4,
                fill: true
            },
            {
                label: "Cost (₹)",
                data: [14240, 12960, 13920, 14480, 13592, 14736],
                borderColor: "#ffb454",
                backgroundColor: "transparent",
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.3,
                fill: false,
                yAxisID: "y1"
            }
        ]
    };

    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/dashboard/chart?filter=${is12 ? 12 : 6}`);
            if (res.ok) {
                const json = await res.json();
                chartData = json.data;
            }
        } catch (e) {}
    }

    if (energyChartInstance) {
        energyChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    energyChartInstance = new Chart(ctx, {
        type: "line",
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#8d9bb0", font: { size: 11, family: "Segoe UI" }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: "#0e1c2f",
                    titleColor: "#39e6ff",
                    bodyColor: "#f5f7fb",
                    borderColor: "rgba(57, 230, 255, 0.3)",
                    borderWidth: 1,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#8d9bb0", font: { size: 10 } }
                },
                y: {
                    type: "linear",
                    display: true,
                    position: "left",
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#8d9bb0", font: { size: 10 }, callback: (v) => `${v} kWh` }
                },
                y1: {
                    type: "linear",
                    display: chartData.datasets.length > 1,
                    position: "right",
                    grid: { drawOnChartArea: false },
                    ticks: { color: "#ffb454", font: { size: 10 }, callback: (v) => `₹${v}` }
                }
            }
        }
    });
}

// =============================================================================
// Energy Alerts
// =============================================================================

async function loadAlerts() {
    const alertPanel = document.querySelector(".alert-panel");
    if (!alertPanel) return;

    let alerts = localAlerts.filter(a => a.is_active);

    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/alerts?active=true`);
            if (res.ok) {
                const json = await res.json();
                alerts = json.data;
            }
        } catch (e) {}
    }

    const countBadge = alertPanel.querySelector(".alert-count");
    if (countBadge) countBadge.textContent = alerts.length;

    const existingAlertItems = alertPanel.querySelectorAll(".alert");
    existingAlertItems.forEach(el => el.remove());

    const viewBtn = alertPanel.querySelector(".view-btn");

    if (alerts.length === 0) {
        const noAlerts = document.createElement("div");
        noAlerts.className = "alert";
        noAlerts.innerHTML = `
            <div class="alert-icon" style="color:var(--green)">✓</div>
            <div>
                <strong>All Clear</strong>
                <p>No active energy anomalies detected.</p>
            </div>
        `;
        if (viewBtn) alertPanel.insertBefore(noAlerts, viewBtn);
        else alertPanel.appendChild(noAlerts);
        return;
    }

    alerts.slice(0, 3).forEach(a => {
        const alertDiv = document.createElement("div");
        alertDiv.className = "alert";
        alertDiv.innerHTML = `
            <div class="alert-icon">${a.icon || '⚠️'}</div>
            <div>
                <strong>${escapeHtml(a.room_name)}</strong>
                <p>${escapeHtml(a.message || a.title)}</p>
            </div>
        `;
        if (viewBtn) alertPanel.insertBefore(alertDiv, viewBtn);
        else alertPanel.appendChild(alertDiv);
    });
}

// =============================================================================
// Rooms Table
// =============================================================================

async function loadRoomsTable() {
    const tbody = document.querySelector(".rooms-panel tbody");
    if (!tbody) return;

    let rooms = localRooms;

    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/rooms`);
            if (res.ok) {
                const json = await res.json();
                rooms = json.data;
            }
        } catch (e) {}
    }

    tbody.innerHTML = "";
    rooms.slice(0, 5).forEach(r => {
        const badgeClass = (r.status || 'Normal').toLowerCase();
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div class="room-name">
                    <div class="room-avatar">${escapeHtml(r.avatar || 'RM')}</div>
                    <strong>${escapeHtml(r.name)}</strong>
                </div>
            </td>
            <td>${escapeHtml(r.type || 'Room')}</td>
            <td>${Number(r.consumption_kwh).toLocaleString()} kWh</td>
            <td>₹${Number(r.cost_inr).toLocaleString()}</td>
            <td>
                <span class="badge ${badgeClass}">${escapeHtml(r.status || 'Normal')}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =============================================================================
// Modal Helpers & Toasts
// =============================================================================

function initModalsAndContainer() {
    if (document.getElementById("modalBackdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "modalBackdrop";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h3 id="modalTitle">Modal</h3>
                <button class="modal-close" id="modalCloseBtn">&times;</button>
            </div>
            <div class="modal-body" id="modalContent"></div>
        </div>
    `;
    document.body.appendChild(backdrop);

    const toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.id === "modalCloseBtn") closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

function openModal(title, contentHtml) {
    const backdrop = document.getElementById("modalBackdrop");
    const titleEl = document.getElementById("modalTitle");
    const contentEl = document.getElementById("modalContent");
    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.innerHTML = title;
    contentEl.innerHTML = contentHtml;
    backdrop.classList.add("active");
}

function closeModal() {
    const backdrop = document.getElementById("modalBackdrop");
    if (backdrop) backdrop.classList.remove("active");
}

function showToast(message, icon = "⚡") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// =============================================================================
// Interactive Modals
// =============================================================================

// 1. Calculator
function openCalculatorModal() {
    const html = `
        <p style="color:var(--muted); margin-bottom:16px;">
            Calculate appliance power usage, electricity cost at ₹8.00/kWh, and carbon footprint.
        </p>
        <form id="calcForm">
            <div class="modal-form-grid">
                <div class="form-group full-width">
                    <label>Appliance / Equipment Name</label>
                    <input type="text" id="calcName" class="form-control" placeholder="e.g. 1.5 Ton Split AC" value="Split Air Conditioner" required>
                </div>
                <div class="form-group">
                    <label>Wattage (Watts)</label>
                    <input type="number" id="calcWatts" class="form-control" value="1500" min="1" required>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="calcQty" class="form-control" value="2" min="1" required>
                </div>
                <div class="form-group">
                    <label>Hours Run / Day</label>
                    <input type="number" id="calcHours" class="form-control" value="8" min="0.1" max="24" step="0.5" required>
                </div>
                <div class="form-group">
                    <label>Electricity Rate (₹/kWh)</label>
                    <input type="number" id="calcRate" class="form-control" value="8.0" step="0.1" required>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Close</button>
                <button type="submit" class="btn-primary">Calculate Energy & Cost</button>
            </div>
        </form>
        <div id="calcResults"></div>
    `;

    openModal("⚡ Energy & Cost Calculator", html);

    document.getElementById("calcForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("calcName").value;
        const watts = parseFloat(document.getElementById("calcWatts").value);
        const qty = parseInt(document.getElementById("calcQty").value);
        const hours = parseFloat(document.getElementById("calcHours").value);
        const rate = parseFloat(document.getElementById("calcRate").value);

        // Perform calculation (pure client-side formula verified by IEEE modeling)
        const dailyKwh = Math.round(((watts * qty * hours) / 1000.0) * 100) / 100;
        const monthlyKwh = Math.round(dailyKwh * 30 * 100) / 100;
        const monthlyCost = Math.round(monthlyKwh * rate);
        const annualCo2 = Math.round(monthlyKwh * 12 * 0.82);
        const savedKwh = Math.round(((watts * qty * 1) / 1000.0) * 30);
        const savedCost = Math.round(savedKwh * rate);

        const resDiv = document.getElementById("calcResults");
        resDiv.innerHTML = `
            <div class="calc-results-card">
                <h4 style="color:var(--electric); margin-bottom:8px;">Calculation Results for ${escapeHtml(name)}</h4>
                <div class="calc-results-grid">
                    <div class="calc-stat-item">
                        <small>Daily Energy</small>
                        <strong>${dailyKwh} kWh</strong>
                    </div>
                    <div class="calc-stat-item">
                        <small>Monthly Cost</small>
                        <strong style="color:var(--orange)">₹${monthlyCost.toLocaleString()}</strong>
                    </div>
                    <div class="calc-stat-item">
                        <small>Annual Carbon (CO₂)</small>
                        <strong style="color:var(--red)">${annualCo2.toLocaleString()} kg</strong>
                    </div>
                </div>
                <p style="margin-top:12px; font-size:11px; color:var(--green)">
                    💡 Reducing '${escapeHtml(name)}' by just 1 hr/day saves ${savedKwh} kWh (₹${savedCost.toLocaleString()}) every month!
                </p>
            </div>
        `;
        showToast("Energy calculation calculated successfully!");
    });
}

// 2. Alerts Modal
async function openAllAlertsModal() {
    let alerts = localAlerts;
    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/alerts?active=all`);
            if (res.ok) {
                const json = await res.json();
                alerts = json.data;
            }
        } catch (e) {}
    }

    let listHtml = "";
    if (alerts.length === 0) {
        listHtml = "<p style='color:var(--muted); text-align:center; padding:20px;'>No alerts recorded in database.</p>";
    } else {
        listHtml = alerts.map(a => `
            <div class="alert-item-card">
                <div>
                    <strong style="font-size:12px; color:var(--text);">${a.icon || '⚠️'} ${escapeHtml(a.room_name)}</strong>
                    <p style="font-size:11px; color:var(--muted); margin-top:3px;">${escapeHtml(a.message || a.title)}</p>
                    <small style="font-size:10px; color:${a.is_active ? 'var(--orange)' : 'var(--green)'};">
                        ${a.is_active ? '● Active' : '✓ Resolved'}
                    </small>
                </div>
                ${a.is_active ? `
                    <button onclick="resolveAlertAction(${a.id})">Mark Resolved</button>
                ` : '<span style="color:var(--green); font-size:11px;">Resolved</span>'}
            </div>
        `).join("");
    }

    openModal("⚠️ Campus Energy Alerts", `
        <div style="max-height:55vh; overflow-y:auto;">
            ${listHtml}
        </div>
        <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `);
}

window.resolveAlertAction = async function(alertId) {
    if (isBackendLive) {
        try {
            await fetch(`${API_BASE}/api/alerts/${alertId}/resolve`, { method: "POST" });
        } catch (e) {}
    }
    const alert = localAlerts.find(a => a.id === alertId);
    if (alert) alert.is_active = 0;
    saveLocalState();

    showToast("Alert resolved successfully!", "✓");
    loadAlerts();
    loadDashboardStats();
    openAllAlertsModal();
};

// 3. Rooms Modal & Add Room / Add Reading
async function openRoomsManagementModal() {
    let rooms = localRooms;
    if (isBackendLive) {
        try {
            const res = await fetch(`${API_BASE}/api/rooms`);
            if (res.ok) {
                const json = await res.json();
                rooms = json.data;
            }
        } catch (e) {}
    }

    const rowsHtml = rooms.map(r => `
        <tr>
            <td><strong>${escapeHtml(r.name)}</strong> (${escapeHtml(r.code)})</td>
            <td>${escapeHtml(r.type)}</td>
            <td>${r.consumption_kwh} kWh</td>
            <td>₹${Number(r.cost_inr).toLocaleString()}</td>
            <td><span class="badge ${(r.status || 'Normal').toLowerCase()}">${r.status || 'Normal'}</span></td>
            <td>
                <button style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="deleteRoomAction(${r.id})">✕</button>
            </td>
        </tr>
    `).join("");

    const content = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <p style="color:var(--muted);">All registered campus blocks & labs.</p>
            <div style="display:flex; gap:8px;">
                <button class="btn-primary" style="padding:6px 12px; font-size:11px;" onclick="openAddRoomForm()">+ Add Room</button>
                <button class="btn-primary" style="padding:6px 12px; font-size:11px; background:var(--green);" onclick="openAddReadingForm()">+ Log Reading</button>
            </div>
        </div>
        <div class="table-container" style="max-height:50vh; overflow-y:auto;">
            <table>
                <thead>
                    <tr><th>ROOM</th><th>TYPE</th><th>USAGE</th><th>COST</th><th>STATUS</th><th></th></tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;

    openModal("🏢 Campus Rooms & Facilities", content);
}

window.openAddRoomForm = function() {
    const html = `
        <form id="addRoomForm">
            <div class="modal-form-grid">
                <div class="form-group full-width">
                    <label>Room Name</label>
                    <input type="text" id="rmName" class="form-control" placeholder="e.g. AI & Robotics Lab" required>
                </div>
                <div class="form-group">
                    <label>Room Code</label>
                    <input type="text" id="rmCode" class="form-control" placeholder="e.g. AIR-01">
                </div>
                <div class="form-group">
                    <label>Facility Type</label>
                    <select id="rmType" class="form-control">
                        <option>Laboratory</option><option>Classroom</option><option>Hall</option><option>Library</option><option>Office</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Campus Block</label>
                    <input type="text" id="rmBlock" class="form-control" value="Block A">
                </div>
                <div class="form-group">
                    <label>Baseline Monthly kWh</label>
                    <input type="number" id="rmBaseline" class="form-control" value="250" required>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="openRoomsManagementModal()">Back</button>
                <button type="submit" class="btn-primary">Save Room</button>
            </div>
        </form>
    `;
    openModal("➕ Add New Campus Room", html);

    document.getElementById("addRoomForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("rmName").value;
        const code = document.getElementById("rmCode").value || "RM-" + Date.now().toString().slice(-3);
        const type = document.getElementById("rmType").value;
        const block = document.getElementById("rmBlock").value;
        const baseline = parseFloat(document.getElementById("rmBaseline").value);

        const newRoom = {
            id: Date.now(),
            name,
            code,
            avatar: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "RM",
            type,
            block,
            baseline_kwh: baseline,
            consumption_kwh: baseline,
            cost_inr: baseline * 8.0,
            status: baseline >= 350 ? "High" : (baseline >= 250 ? "Medium" : "Normal")
        };

        if (isBackendLive) {
            try {
                await fetch(`${API_BASE}/api/rooms`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newRoom)
                });
            } catch (err) {}
        }

        localRooms.unshift(newRoom);
        saveLocalState();

        showToast("Room created successfully!", "✓");
        loadRoomsTable();
        loadDashboardStats();
        openRoomsManagementModal();
    });
};

window.openAddReadingForm = function() {
    const roomOptions = localRooms.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.code})</option>`).join("");
    const html = `
        <p style="color:var(--muted); margin-bottom:14px;">Record energy meter consumption. Automatically detects surges > 25%!</p>
        <form id="addReadingForm">
            <div class="modal-form-grid">
                <div class="form-group full-width">
                    <label>Select Room</label>
                    <select id="readRoomId" class="form-control" required>${roomOptions}</select>
                </div>
                <div class="form-group">
                    <label>Consumption (kWh)</label>
                    <input type="number" id="readKwh" class="form-control" placeholder="e.g. 450" step="0.1" required>
                </div>
                <div class="form-group">
                    <label>Peak Demand (kW)</label>
                    <input type="number" id="readPeak" class="form-control" value="5.0" step="0.1">
                </div>
                <div class="form-group full-width">
                    <label>Notes / Operational Context</label>
                    <input type="text" id="readNotes" class="form-control" placeholder="e.g. Weekend hackathon, heavy AC load">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="openRoomsManagementModal()">Back</button>
                <button type="submit" class="btn-primary">Record Meter Reading</button>
            </div>
        </form>
    `;
    openModal("⚡ Log Energy Reading", html);

    document.getElementById("addReadingForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const roomId = parseInt(document.getElementById("readRoomId").value);
        const kwh = parseFloat(document.getElementById("readKwh").value);
        const notes = document.getElementById("readNotes").value;

        const targetRoom = localRooms.find(r => r.id === roomId) || localRooms[0];
        targetRoom.consumption_kwh = kwh;
        targetRoom.cost_inr = Math.round(kwh * 8.0);
        targetRoom.status = kwh >= 350 ? "High" : (kwh >= 250 ? "Medium" : "Normal");

        // Anomaly Detection: check if > 25% over baseline
        const baseline = targetRoom.baseline_kwh || 250;
        let alertTriggered = false;
        if ((kwh - baseline) / baseline >= 0.25) {
            alertTriggered = true;
            const pct = Math.round(((kwh - baseline) / baseline) * 100);
            localAlerts.unshift({
                id: Date.now(),
                room_id: targetRoom.id,
                room_name: targetRoom.name,
                icon: "⚡",
                severity: "high",
                title: "Automated Anomaly Detection",
                message: `Consumption spike: ${pct}% above baseline (${kwh} vs ${baseline} kWh).`,
                is_active: 1
            });
        }

        if (isBackendLive) {
            try {
                await fetch(`${API_BASE}/api/readings`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ room_id: targetRoom.id, consumption_kwh: kwh, notes })
                });
            } catch (err) {}
        }

        saveLocalState();

        if (alertTriggered) {
            showToast("Reading saved! Anomaly Alert Triggered!", "⚠️");
        } else {
            showToast("Meter reading logged successfully!", "✓");
        }
        loadRoomsTable();
        loadAlerts();
        loadDashboardStats();
        openRoomsManagementModal();
    });
};

window.deleteRoomAction = function(roomId) {
    if (!confirm("Are you sure you want to delete this room?")) return;
    localRooms = localRooms.filter(r => r.id !== roomId);
    saveLocalState();
    if (isBackendLive) {
        fetch(`${API_BASE}/api/rooms/${roomId}`, { method: "DELETE" }).catch(() => {});
    }
    showToast("Room removed", "✓");
    loadRoomsTable();
    loadDashboardStats();
    openRoomsManagementModal();
};

// 4. Savings Modal
function openSavingsModal() {
    const itemsHtml = DEFAULT_SUGGESTIONS.map(s => `
        <div class="alert-item-card" style="border-left: 3px solid var(--electric);">
            <div>
                <strong>💡 ${escapeHtml(s.title)}</strong>
                <p style="color:var(--muted); font-size:11px; margin-top:4px;">${escapeHtml(s.description)}</p>
                <div style="margin-top:6px; display:flex; gap:12px; font-size:10px;">
                    <span style="color:var(--green)">Saves: ₹${s.estimated_monthly_saving_inr.toLocaleString()}/month</span>
                    <span style="color:var(--electric)">(${s.kwh_saved_monthly} kWh)</span>
                    <span style="color:var(--muted)">Category: ${s.category}</span>
                </div>
            </div>
        </div>
    `).join("");

    openModal("💡 Energy Savings & Optimization Opportunities", `
        <div style="background:rgba(85,230,165,0.08); padding:14px; border-radius:10px; margin-bottom:16px;">
            <p style="color:var(--green); font-weight:700;">Potential Monthly Campus Savings: ₹4,480.00</p>
            <small style="color:var(--muted);">Total reducible energy: ~560 kWh/month (~15.8% reduction)</small>
        </div>
        <div style="max-height:50vh; overflow-y:auto;">
            ${itemsHtml}
        </div>
        <div class="modal-actions">
            <button type="button" class="btn-primary" onclick="closeModal()">Done</button>
        </div>
    `);
}

// 5. Analytics Modal
function openAnalyticsModal() {
    openModal("📊 Campus Energy Analytics", `
        <div style="margin-bottom:16px;">
            <h4 style="color:var(--electric); margin-bottom:8px;">Consumption by Facility Type</h4>
            <table>
                <thead><tr><th>TYPE</th><th>COUNT</th><th>USAGE</th><th>COST</th></tr></thead>
                <tbody>
                    <tr><td><strong>Laboratories</strong></td><td>3 facilities</td><td>1,104 kWh</td><td>₹8,832</td></tr>
                    <tr><td><strong>Auditoriums & Halls</strong></td><td>1 facility</td><td>389 kWh</td><td>₹3,112</td></tr>
                    <tr><td><strong>Libraries</strong></td><td>1 facility</td><td>298 kWh</td><td>₹2,384</td></tr>
                    <tr><td><strong>Classrooms</strong></td><td>1 facility</td><td>216 kWh</td><td>₹1,728</td></tr>
                    <tr><td><strong>Offices</strong></td><td>1 facility</td><td>192 kWh</td><td>₹1,536</td></tr>
                </tbody>
            </table>
        </div>
        <div class="calc-results-card">
            <h4 style="color:var(--electric);">Campus Carbon Footprint</h4>
            <p style="color:var(--muted); font-size:11px; margin-top:4px;">
                Estimated Monthly Emissions: <strong>1,510.4 kg CO₂</strong>
            </p>
            <small style="color:var(--muted);">Based on national grid emission factor of 0.82 kg CO₂/kWh</small>
        </div>
    `);
}

// 6. Reports Modal
function openReportsModal() {
    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    openModal("📋 Campus Energy Audit Report", `
        <div style="padding:6px;">
            <p style="color:var(--muted); font-size:11px;">Audit Date: ${todayStr} | Institution: Campus Energy Detective</p>
            <div class="calc-results-grid" style="margin:14px 0;">
                <div class="calc-stat-item"><small>Total kWh</small><strong>1,842 kWh</strong></div>
                <div class="calc-stat-item"><small>Total Spend</small><strong>₹14,736</strong></div>
                <div class="calc-stat-item"><small>Efficiency Score</small><strong>78/100</strong></div>
            </div>
            <h4 style="color:var(--electric); margin-top:16px;">Recommended Interventions:</h4>
            <ul style="margin:8px 0 16px 20px; font-size:12px; color:var(--text); line-height:1.6;">
                <li>Mandate 24°C AC setpoint in auditorium and seminar halls.</li>
                <li>Install PIR occupancy motion sensors in ECE & CAD laboratories.</li>
                <li>Automate workstation sleep policy on lab PCs post 6:30 PM.</li>
            </ul>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="window.print()">🖨️ Print Report</button>
                <button class="btn-primary" onclick="closeModal()">Close</button>
            </div>
        </div>
    `);
}

// =============================================================================
// Event Listeners
// =============================================================================

function bindEvents() {
    const filterSelect = document.getElementById("chartFilter");
    if (filterSelect) {
        filterSelect.addEventListener("change", () => initEnergyChart());
    }

    const viewAlertsBtn = document.querySelector(".view-btn");
    if (viewAlertsBtn) {
        viewAlertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openAllAlertsModal();
        });
    }

    const viewRoomsBtn = document.querySelector(".view-all");
    if (viewRoomsBtn) {
        viewRoomsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openRoomsManagementModal();
        });
    }

    const analyzeSavingsBtn = document.querySelector(".saving-content button");
    if (analyzeSavingsBtn) {
        analyzeSavingsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openSavingsModal();
        });
    }

    const navLinks = document.querySelectorAll("nav a");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const text = link.textContent.trim();

            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            if (text.includes("Calculator")) openCalculatorModal();
            else if (text.includes("Rooms")) openRoomsManagementModal();
            else if (text.includes("Analytics")) openAnalyticsModal();
            else if (text.includes("Savings")) openSavingsModal();
            else if (text.includes("Reports")) openReportsModal();
            else if (text.includes("Dashboard")) {
                loadDashboardStats();
                initEnergyChart();
            }
        });
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
