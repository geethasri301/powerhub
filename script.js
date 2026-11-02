/**
 * Campus Energy Detective - Frontend Controller
 * =============================================
 * Connects the UI to the backend REST API.
 * Handles live dashboard stats, Chart.js updates, dynamic rooms table,
 * alert resolution, energy calculator, and modals.
 */

// Base API URL (handles both localhost:5000 and direct file viewing)
const API_BASE = window.location.origin.startsWith("http") 
    ? window.location.origin 
    : "http://localhost:5000";

let energyChartInstance = null;

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
    initModalsAndContainer();
    loadDashboardStats();
    initEnergyChart();
    loadAlerts();
    loadRoomsTable();
    bindEvents();
    checkBackendHealth();
});

// Check if backend is online and update status dot
async function checkBackendHealth() {
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
            const data = await res.json();
            const statusText = document.querySelector(".system-status");
            if (statusText) {
                statusText.innerHTML = `<span class="status-dot"></span> System Online (Live DB)`;
            }
        }
    } catch (e) {
        const statusText = document.querySelector(".system-status");
        if (statusText) {
            statusText.innerHTML = `<span class="status-dot" style="background:#ffb454;box-shadow:0 0 10px #ffb454;"></span> Demo Mode (Run server.py)`;
        }
    }
}

// =============================================================================
// Dashboard Data & Cards
// =============================================================================

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard`);
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        const json = await res.json();
        const data = json.data;

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

    } catch (err) {
        console.warn("Using dashboard fallback metrics:", err.message);
    }
}

// =============================================================================
// Chart.js Energy Consumption Chart
// =============================================================================

async function initEnergyChart() {
    const canvas = document.getElementById("energyChart");
    if (!canvas) return;

    const filterSelect = document.getElementById("chartFilter");
    const filterVal = filterSelect ? filterSelect.value : "Last 6 Months";
    const months = filterVal.includes("12") ? 12 : 6;

    let chartData = {
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
            }
        ]
    };

    try {
        const res = await fetch(`${API_BASE}/api/dashboard/chart?filter=${months}`);
        if (res.ok) {
            const json = await res.json();
            chartData = json.data;
        }
    } catch (e) {
        console.warn("Chart data fallback:", e.message);
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
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "#8d9bb0",
                        font: { size: 11, family: "Segoe UI" },
                        boxWidth: 12
                    }
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
                    ticks: {
                        color: "#8d9bb0",
                        font: { size: 10 },
                        callback: (v) => `${v} kWh`
                    }
                },
                y1: {
                    type: "linear",
                    display: chartData.datasets.length > 1,
                    position: "right",
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: "#ffb454",
                        font: { size: 10 },
                        callback: (v) => `₹${v}`
                    }
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

    try {
        const res = await fetch(`${API_BASE}/api/alerts?active=true`);
        if (!res.ok) throw new Error("Failed to fetch alerts");
        const json = await res.json();
        const alerts = json.data;

        // Update alert count badge
        const countBadge = alertPanel.querySelector(".alert-count");
        if (countBadge) countBadge.textContent = alerts.length;

        // Keep header and view button, replace alert items
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

        alerts.slice(0, 4).forEach(a => {
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

    } catch (e) {
        console.warn("Using fallback alerts:", e.message);
    }
}

// =============================================================================
// Rooms Table
// =============================================================================

async function loadRoomsTable() {
    const tbody = document.querySelector(".rooms-panel tbody");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/api/rooms`);
        if (!res.ok) throw new Error("Failed to fetch rooms");
        const json = await res.json();
        const rooms = json.data;

        tbody.innerHTML = "";
        rooms.slice(0, 5).forEach(r => {
            const badgeClass = r.status.toLowerCase();
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
                    <span class="badge ${badgeClass}">${escapeHtml(r.status)}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.warn("Using fallback rooms table:", e.message);
    }
}

// =============================================================================
// Modals & User Interaction
// =============================================================================

function initModalsAndContainer() {
    // Check if modal backdrop already exists
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

    // Toast Container
    const toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);

    // Event to close modal on backdrop or close button
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop || e.target.id === "modalCloseBtn") {
            closeModal();
        }
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
// Modal Dialogs: Calculator, Alerts, Rooms, Savings, Reports
// =============================================================================

// 1. Energy & Cost Calculator Modal
function openCalculatorModal() {
    const html = `
        <p style="color:var(--muted); margin-bottom:16px;">
            Calculate appliance power usage, electricity cost at ₹8.00/kWh, and carbon footprint.
        </p>
        <form id="calcForm">
            <div class="modal-form-grid">
                <div class="form-group full-width">
                    <label>Appliance / Equipment Name</label>
                    <input type="text" id="calcName" class="form-control" placeholder="e.g. 1.5 Ton Split AC, Computer Workstation" value="Split Air Conditioner" required>
                </div>
                <div class="form-group">
                    <label>Wattage (Watts)</label>
                    <input type="number" id="calcWatts" class="form-control" placeholder="Watts" value="1500" min="1" required>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="calcQty" class="form-control" placeholder="Units" value="2" min="1" required>
                </div>
                <div class="form-group">
                    <label>Hours Run / Day</label>
                    <input type="number" id="calcHours" class="form-control" placeholder="Hours" value="8" min="0.1" max="24" step="0.5" required>
                </div>
                <div class="form-group">
                    <label>Electricity Rate (₹/kWh)</label>
                    <input type="number" id="calcRate" class="form-control" placeholder="Rate in ₹" value="8.0" step="0.1" required>
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
        const payload = {
            appliance_name: document.getElementById("calcName").value,
            wattage: parseFloat(document.getElementById("calcWatts").value),
            quantity: parseInt(document.getElementById("calcQty").value),
            hours_per_day: parseFloat(document.getElementById("calcHours").value),
            rate_per_kwh: parseFloat(document.getElementById("calcRate").value)
        };

        try {
            const res = await fetch(`${API_BASE}/api/calculator`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            const d = json.data;

            const resDiv = document.getElementById("calcResults");
            resDiv.innerHTML = `
                <div class="calc-results-card">
                    <h4 style="color:var(--electric); margin-bottom:8px;">Calculation Results for ${escapeHtml(d.inputs.appliance_name)}</h4>
                    <div class="calc-results-grid">
                        <div class="calc-stat-item">
                            <small>Daily Energy</small>
                            <strong>${d.consumption.daily_kwh} kWh</strong>
                        </div>
                        <div class="calc-stat-item">
                            <small>Monthly Cost</small>
                            <strong style="color:var(--orange)">₹${d.cost.monthly_inr.toLocaleString()}</strong>
                        </div>
                        <div class="calc-stat-item">
                            <small>Annual Carbon (CO₂)</small>
                            <strong style="color:var(--red)">${d.environmental_impact.annual_co2_kg} kg</strong>
                        </div>
                    </div>
                    <p style="margin-top:12px; font-size:11px; color:var(--green)">
                        💡 ${escapeHtml(d.optimization_tip.tip)}
                    </p>
                </div>
            `;
            showToast("Energy calculation saved to audit history!");
        } catch (err) {
            showToast("Calculation error: " + err.message, "⚠️");
        }
    });
}

// 2. View All Alerts Modal
async function openAllAlertsModal() {
    try {
        const res = await fetch(`${API_BASE}/api/alerts?active=all`);
        const json = await res.json();
        const alerts = json.data || [];

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
    } catch (e) {
        showToast("Error loading alerts: " + e.message, "⚠️");
    }
}

// Resolve Alert Action
window.resolveAlertAction = async function(alertId) {
    try {
        const res = await fetch(`${API_BASE}/api/alerts/${alertId}/resolve`, { method: "POST" });
        if (res.ok) {
            showToast("Alert resolved successfully!", "✓");
            loadAlerts();
            loadDashboardStats();
            openAllAlertsModal(); // refresh view
        }
    } catch (e) {
        showToast("Error resolving alert", "⚠️");
    }
};

// 3. View All Rooms & Add Room Modal
async function openRoomsManagementModal() {
    try {
        const res = await fetch(`${API_BASE}/api/rooms`);
        const json = await res.json();
        const rooms = json.data || [];

        const rowsHtml = rooms.map(r => `
            <tr>
                <td><strong>${escapeHtml(r.name)}</strong> (${escapeHtml(r.code)})</td>
                <td>${escapeHtml(r.type)}</td>
                <td>${r.consumption_kwh} kWh</td>
                <td>₹${r.cost_inr}</td>
                <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
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
                        <tr>
                            <th>ROOM</th>
                            <th>TYPE</th>
                            <th>USAGE</th>
                            <th>COST</th>
                            <th>STATUS</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;

        openModal("🏢 Campus Rooms & Facilities", content);
    } catch (e) {
        showToast("Error loading rooms: " + e.message, "⚠️");
    }
}

// Open Add Room Form
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
                        <option>Laboratory</option>
                        <option>Classroom</option>
                        <option>Hall</option>
                        <option>Library</option>
                        <option>Office</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Campus Block</label>
                    <input type="text" id="rmBlock" class="form-control" placeholder="Block A, B, etc." value="Block A">
                </div>
                <div class="form-group">
                    <label>Baseline Monthly kWh</label>
                    <input type="number" id="rmBaseline" class="form-control" placeholder="kWh" value="250" required>
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
        const payload = {
            name: document.getElementById("rmName").value,
            code: document.getElementById("rmCode").value,
            type: document.getElementById("rmType").value,
            block: document.getElementById("rmBlock").value,
            baseline_kwh: parseFloat(document.getElementById("rmBaseline").value)
        };

        const res = await fetch(`${API_BASE}/api/rooms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Room created successfully!", "✓");
            loadRoomsTable();
            loadDashboardStats();
            openRoomsManagementModal();
        } else {
            const err = await res.json();
            showToast(err.message || "Failed to create room", "⚠️");
        }
    });
};

// Open Add Meter Reading Form
window.openAddReadingForm = async function() {
    let roomOptions = "";
    try {
        const res = await fetch(`${API_BASE}/api/rooms`);
        const json = await res.json();
        roomOptions = (json.data || []).map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.code})</option>`).join("");
    } catch (e) {
        roomOptions = "<option value='1'>CSE Lab - A</option>";
    }

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
                    <input type="number" id="readKwh" class="form-control" placeholder="e.g. 420" step="0.1" required>
                </div>
                <div class="form-group">
                    <label>Peak Demand (kW)</label>
                    <input type="number" id="readPeak" class="form-control" placeholder="e.g. 6.5" step="0.1" value="5.0">
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
        const payload = {
            room_id: parseInt(document.getElementById("readRoomId").value),
            consumption_kwh: parseFloat(document.getElementById("readKwh").value),
            peak_kw: parseFloat(document.getElementById("readPeak").value),
            notes: document.getElementById("readNotes").value
        };

        const res = await fetch(`${API_BASE}/api/readings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.alert_triggered) {
                showToast("Reading saved! Anomaly Alert Triggered!", "⚠️");
            } else {
                showToast("Meter reading logged successfully!", "✓");
            }
            loadRoomsTable();
            loadAlerts();
            loadDashboardStats();
            openRoomsManagementModal();
        } else {
            showToast("Failed to record reading", "⚠️");
        }
    });
};

// Delete Room Action
window.deleteRoomAction = async function(roomId) {
    if (!confirm("Are you sure you want to delete this room?")) return;
    try {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Room removed", "✓");
            loadRoomsTable();
            loadDashboardStats();
            openRoomsManagementModal();
        }
    } catch (e) {
        showToast("Error deleting room", "⚠️");
    }
};

// 4. Savings Analysis Modal
async function openSavingsModal() {
    try {
        const res = await fetch(`${API_BASE}/api/savings`);
        const json = await res.json();
        const suggestions = json.suggestions || [];

        const itemsHtml = suggestions.map(s => `
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
                <p style="color:var(--green); font-weight:700;">
                    Potential Monthly Campus Savings: ₹${Number(json.total_potential_monthly_saving_inr).toLocaleString()}
                </p>
                <small style="color:var(--muted);">Total reducible energy: ~${json.total_potential_monthly_kwh_saved} kWh/month</small>
            </div>
            <div style="max-height:50vh; overflow-y:auto;">
                ${itemsHtml}
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-primary" onclick="closeModal()">Done</button>
            </div>
        `);
    } catch (e) {
        showToast("Error loading savings: " + e.message, "⚠️");
    }
}

// 5. Analytics Modal
async function openAnalyticsModal() {
    try {
        const res = await fetch(`${API_BASE}/api/analytics`);
        const json = await res.json();
        const d = json.data;

        const typeRows = d.by_room_type.map(t => `
            <tr>
                <td><strong>${escapeHtml(t.type)}</strong></td>
                <td>${t.count} facilities</td>
                <td>${t.total_kwh} kWh</td>
                <td>₹${t.total_cost}</td>
            </tr>
        `).join("");

        openModal("📊 Campus Energy Analytics", `
            <div style="margin-bottom:16px;">
                <h4 style="color:var(--electric); margin-bottom:8px;">Consumption by Facility Type</h4>
                <table>
                    <thead><tr><th>TYPE</th><th>COUNT</th><th>USAGE</th><th>COST</th></tr></thead>
                    <tbody>${typeRows}</tbody>
                </table>
            </div>
            <div class="calc-results-card">
                <h4 style="color:var(--electric);">Campus Carbon Footprint</h4>
                <p style="color:var(--muted); font-size:11px; margin-top:4px;">
                    Estimated Monthly Emissions: <strong>${d.estimated_monthly_carbon_footprint_kg.toLocaleString()} kg CO₂</strong>
                </p>
                <small style="color:var(--muted);">Based on grid emission factor of 0.82 kg CO₂/kWh</small>
            </div>
        `);
    } catch (e) {
        showToast("Error loading analytics: " + e.message, "⚠️");
    }
}

// 6. Reports Modal
async function openReportsModal() {
    try {
        const res = await fetch(`${API_BASE}/api/reports/summary`);
        const json = await res.json();
        const s = json.audit_summary;

        openModal("📋 Campus Energy Audit Report", `
            <div style="padding:6px;">
                <p style="color:var(--muted); font-size:11px;">Generated on: ${json.report_generated_at}</p>
                <div class="calc-results-grid" style="margin:14px 0;">
                    <div class="calc-stat-item"><small>Total kWh</small><strong>${s.total_energy_kwh}</strong></div>
                    <div class="calc-stat-item"><small>Total Spend</small><strong>₹${s.total_cost_inr}</strong></div>
                    <div class="calc-stat-item"><small>Efficiency</small><strong>${s.efficiency_score}/100</strong></div>
                </div>
                <h4 style="color:var(--electric); margin-top:16px;">Recommended Interventions:</h4>
                <ul style="margin:8px 0 16px 20px; font-size:12px; color:var(--text); line-height:1.6;">
                    ${json.recommended_interventions.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
                </ul>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="window.print()">🖨️ Print Report</button>
                    <button class="btn-primary" onclick="closeModal()">Close</button>
                </div>
            </div>
        `);
    } catch (e) {
        showToast("Error loading report: " + e.message, "⚠️");
    }
}

// =============================================================================
// Event Listeners
// =============================================================================

function bindEvents() {
    // Chart filter dropdown
    const filterSelect = document.getElementById("chartFilter");
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            initEnergyChart();
        });
    }

    // View All Alerts button
    const viewAlertsBtn = document.querySelector(".view-btn");
    if (viewAlertsBtn) {
        viewAlertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openAllAlertsModal();
        });
    }

    // View All Rooms button
    const viewRoomsBtn = document.querySelector(".view-all");
    if (viewRoomsBtn) {
        viewRoomsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openRoomsManagementModal();
        });
    }

    // Smart Suggestion Analyze button
    const analyzeSavingsBtn = document.querySelector(".saving-content button");
    if (analyzeSavingsBtn) {
        analyzeSavingsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openSavingsModal();
        });
    }

    // Navigation links binding
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

// Utility: HTML escaping
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
