"""
Campus Energy Detective - Database & Business Logic Module
==========================================================
Manages SQLite database initialization, schema migration, 
seed data generation, and all database query operations.
Supports zero-configuration execution (uses standard Python sqlite3).
"""

import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus_energy.db")

# Campus Electricity Tariff (₹ per kWh)
TARIFF_PER_KWH = 8.00

# High-usage threshold (kWh per month for a room to be flagged as 'High')
HIGH_USAGE_THRESHOLD_KWH = 350.0
MEDIUM_USAGE_THRESHOLD_KWH = 250.0

def get_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_FILE, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initializes database tables and seeds demo campus data if empty."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Rooms Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            avatar TEXT NOT NULL,
            type TEXT NOT NULL,
            block TEXT NOT NULL,
            floor TEXT DEFAULT 'Ground',
            area_sqft REAL DEFAULT 800,
            ac_count INTEGER DEFAULT 2,
            lights_count INTEGER DEFAULT 12,
            computers_count INTEGER DEFAULT 0,
            baseline_kwh REAL DEFAULT 200.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Energy Readings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS energy_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            reading_date DATE NOT NULL,
            month_label TEXT NOT NULL,
            consumption_kwh REAL NOT NULL,
            cost_inr REAL NOT NULL,
            peak_kw REAL DEFAULT 0.0,
            power_factor REAL DEFAULT 0.95,
            status TEXT NOT NULL CHECK(status IN ('Normal', 'Medium', 'High')),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
        )
    """)

    # 3. Monthly Campus Aggregate Stats Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monthly_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_name TEXT NOT NULL,
            month_num INTEGER NOT NULL,
            year INTEGER NOT NULL,
            total_kwh REAL NOT NULL,
            total_cost REAL NOT NULL,
            high_usage_rooms INTEGER NOT NULL,
            efficiency_score INTEGER NOT NULL,
            target_kwh REAL NOT NULL,
            change_pct REAL DEFAULT 0.0,
            UNIQUE(year, month_num)
        )
    """)

    # 4. Energy Alerts Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER,
            room_name TEXT NOT NULL,
            icon TEXT DEFAULT '⚠️',
            severity TEXT NOT NULL CHECK(severity IN ('high', 'medium', 'warning', 'info')),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
        )
    """)

    # 5. Smart Savings Recommendations Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            estimated_monthly_saving_inr REAL NOT NULL,
            kwh_saved_monthly REAL NOT NULL,
            category TEXT NOT NULL,
            difficulty TEXT DEFAULT 'Easy',
            is_applied INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 6. Calculator History / Energy Audit Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS calculator_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appliance_name TEXT NOT NULL,
            wattage REAL NOT NULL,
            quantity INTEGER NOT NULL,
            hours_per_day REAL NOT NULL,
            days_per_month INTEGER DEFAULT 30,
            rate_per_kwh REAL DEFAULT 8.00,
            monthly_kwh REAL NOT NULL,
            monthly_cost REAL NOT NULL,
            annual_co2_kg REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()

    # Seed data if rooms table is empty
    cursor.execute("SELECT COUNT(*) FROM rooms")
    if cursor.fetchone()[0] == 0:
        seed_data(conn)

    conn.close()

def seed_data(conn):
    """Populates realistic initial data matching Campus Energy Detective dashboard."""
    cursor = conn.cursor()
    now = datetime.now()

    # Seed Rooms
    rooms = [
        ("CL-A", "CSE Lab - A", "CL", "Laboratory", "Block A", "1st Floor", 1200, 4, 18, 45, 300.0),
        ("EL-B", "ECE Lab - B", "EL", "Laboratory", "Block B", "2nd Floor", 1000, 3, 16, 30, 260.0),
        ("LH-2", "Lecture Hall 2", "LH", "Classroom", "Block A", "Ground Floor", 1500, 4, 24, 1, 180.0),
        ("SH-1", "Seminar Hall", "SH", "Hall", "Main Auditorium", "Ground Floor", 3500, 8, 40, 2, 280.0),
        ("LIB-1", "Central Library", "CL", "Library", "Central Block", "1st Floor", 4000, 6, 60, 20, 310.0),
        ("CAD-1", "Mechanical CAD Lab", "MC", "Laboratory", "Workshop Block", "Ground Floor", 1100, 3, 14, 35, 290.0),
        ("SRV-1", "Server & Data Center", "SD", "Facility", "Admin Block", "Basement", 600, 4, 8, 12, 420.0),
        ("ADM-1", "Faculty & Admin Offices", "AO", "Office", "Admin Block", "2nd Floor", 1800, 4, 22, 18, 200.0)
    ]

    cursor.executemany("""
        INSERT INTO rooms (code, name, avatar, type, block, floor, area_sqft, ac_count, lights_count, computers_count, baseline_kwh)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rooms)

    # Seed Recent Energy Readings for Current Month
    current_readings = [
        (1, "CSE Lab - A", 428.0, 3424.0, 7.2, "High", "Heavy GPU workstations running overnight training batch"),
        (2, "ECE Lab - B", 312.0, 2496.0, 5.4, "Medium", "Soldering stations and test benches active"),
        (3, "Lecture Hall 2", 216.0, 1728.0, 3.8, "Normal", "Standard projector & lighting usage"),
        (4, "Seminar Hall", 389.0, 3112.0, 8.5, "High", "AC left cooling empty hall between sessions"),
        (5, "Central Library", 298.0, 2384.0, 5.1, "Medium", "Continuous air conditioning during exam prep week"),
        (6, "Mechanical CAD Lab", 364.0, 2912.0, 6.8, "High", "Workstations in high power mode"),
        (7, "Server & Data Center", 442.0, 3536.0, 7.9, "High", "24/7 HVAC cooling critical servers"),
        (8, "Faculty & Admin Offices", 192.0, 1536.0, 3.2, "Normal", "General office computers and lighting")
    ]

    curr_date = now.strftime("%Y-%m-%d")
    month_label = now.strftime("%b %Y")

    for room_id, name, kwh, cost, peak, status, notes in current_readings:
        cursor.execute("""
            INSERT INTO energy_readings (room_id, reading_date, month_label, consumption_kwh, cost_inr, peak_kw, power_factor, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 0.94, ?, ?)
        """, (room_id, curr_date, month_label, kwh, cost, peak, status, notes))

    # Seed 12 Months of Campus Trends (Realistic Academic Calendar)
    monthly_data = [
        ("Nov", 11, 2025, 1720, 13760, 3, 81, 1600, -2.1),
        ("Dec", 12, 2025, 1580, 12640, 2, 84, 1550, -8.1),
        ("Jan", 1, 2026, 1640, 13120, 3, 82, 1550, 3.8),
        ("Feb", 2, 2026, 1710, 13680, 3, 80, 1600, 4.3),
        ("Mar", 3, 2026, 1890, 15120, 4, 76, 1650, 10.5),
        ("Apr", 4, 2026, 2140, 17120, 5, 71, 1700, 13.2),
        ("May", 5, 2026, 1780, 14240, 3, 79, 1600, -16.8),
        ("Jun", 6, 2026, 1620, 12960, 2, 83, 1550, -9.0),
        ("Jul", 7, 2026, 1740, 13920, 3, 81, 1600, 7.4),
        ("Aug", 8, 2026, 1810, 14480, 3, 79, 1600, 4.0),
        ("Sep", 9, 2026, 1699, 13592, 2, 82, 1600, -6.1),
        ("Oct", 10, 2026, 1842, 14736, 4, 78, 1600, 8.4)
    ]

    for m_name, m_num, yr, kwh, cost, high_rms, eff, tgt, chg in monthly_data:
        cursor.execute("""
            INSERT OR REPLACE INTO monthly_stats 
            (month_name, month_num, year, total_kwh, total_cost, high_usage_rooms, efficiency_score, target_kwh, change_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (m_name, m_num, yr, kwh, cost, high_rms, eff, tgt, chg))

    # Seed Energy Alerts
    alerts = [
        (1, "CSE Lab - Block A", "⚠️", "high", "High GPU Load & Extended Hours", "32% above average usage detected over past 7 days."),
        (4, "Seminar Hall", "🔥", "high", "Unscheduled AC Consumption", "AC usage unusually high during unoccupied weekend slots."),
        (2, "ECE Lab", "💡", "warning", "Lighting Inefficiency", "Possible lighting wastage detected during non-instructional hours."),
        (6, "Mechanical CAD Lab", "⚡", "warning", "Peak Demand Surge", "Workstation cluster drew 6.8 kW peak near closing hours.")
    ]

    cursor.executemany("""
        INSERT INTO alerts (room_id, room_name, icon, severity, title, message, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    """, alerts)

    # Seed Smart Savings Recommendations
    suggestions = [
        ("Reduce AC usage by 1 hour/day", "Adjust thermostat to 24°C and power down chillers 1 hour prior to end of classes.", 1200.0, 150.0, "HVAC", "Easy"),
        ("Smart Motion Sensors in ECE & CAD Labs", "Install automatic PIR occupancy sensors to eliminate empty-room lighting wastage.", 850.0, 106.25, "Lighting", "Easy"),
        ("Night-time PC Sleep Policy", "Automate sleep mode on all 120+ computer lab terminals after 6:30 PM.", 1450.0, 181.25, "Equipment", "Medium"),
        ("Solar Pre-cooling for Seminar Hall", "Schedule AC start 20 minutes before events rather than keeping standby chillers active all morning.", 980.0, 122.5, "HVAC", "Easy")
    ]

    cursor.executemany("""
        INSERT INTO savings_suggestions (title, description, estimated_monthly_saving_inr, kwh_saved_monthly, category, difficulty)
        VALUES (?, ?, ?, ?, ?, ?)
    """, suggestions)

    conn.commit()

# ==============================================================================
# Business Logic & Database Access Functions
# ==============================================================================

def get_dashboard_summary():
    """Calculates all key metrics for top-level dashboard stat cards."""
    conn = get_connection()
    cursor = conn.cursor()

    # Get latest monthly stats
    cursor.execute("""
        SELECT total_kwh, total_cost, high_usage_rooms, efficiency_score, change_pct, month_name, year 
        FROM monthly_stats 
        ORDER BY year DESC, month_num DESC 
        LIMIT 1
    """)
    latest = cursor.fetchone()

    # Count active alerts
    cursor.execute("SELECT COUNT(*) FROM alerts WHERE is_active = 1")
    active_alerts_count = cursor.fetchone()[0]

    # Calculate potential savings from suggestions
    cursor.execute("SELECT SUM(estimated_monthly_saving_inr) FROM savings_suggestions WHERE is_applied = 0")
    potential_savings = cursor.fetchone()[0] or 2340.0

    # Total registered rooms
    cursor.execute("SELECT COUNT(*) FROM rooms")
    total_rooms = cursor.fetchone()[0]

    # Current month room stats summary
    cursor.execute("""
        SELECT 
            COUNT(CASE WHEN status = 'High' THEN 1 END) as high_count,
            COUNT(CASE WHEN status = 'Medium' THEN 1 END) as medium_count,
            COUNT(CASE WHEN status = 'Normal' THEN 1 END) as normal_count,
            SUM(consumption_kwh) as total_readings_kwh,
            SUM(cost_inr) as total_readings_cost
        FROM energy_readings
        WHERE strftime('%Y-%m', reading_date) = strftime('%Y-%m', 'now')
           OR month_label LIKE '%' || strftime('%Y', 'now')
    """)
    room_agg = cursor.fetchone()

    total_kwh = latest['total_kwh'] if latest else 1842.0
    total_cost = latest['total_cost'] if latest else 14736.0
    high_rooms = room_agg['high_count'] if room_agg and room_agg['high_count'] else (latest['high_usage_rooms'] if latest else 4)
    efficiency = latest['efficiency_score'] if latest else 78
    kwh_change_pct = latest['change_pct'] if latest else 8.4
    cost_change_pct = round(kwh_change_pct * 0.62, 1)

    conn.close()

    return {
        "status": "success",
        "data": {
            "total_energy_kwh": round(total_kwh, 1),
            "total_cost_inr": round(total_cost, 2),
            "high_usage_rooms": high_rooms,
            "total_rooms": total_rooms,
            "potential_savings_inr": round(potential_savings, 2),
            "potential_savings_pct": 15.8,
            "efficiency_score": efficiency,
            "active_alerts_count": active_alerts_count,
            "energy_change_pct": kwh_change_pct,
            "cost_change_pct": cost_change_pct,
            "tariff_rate": TARIFF_PER_KWH,
            "month_label": f"{latest['month_name']} {latest['year']}" if latest else "Current Month"
        }
    }

def get_chart_data(months_count=6):
    """Returns monthly energy consumption and cost history formatted for Chart.js."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT month_name, year, total_kwh, total_cost, target_kwh 
        FROM monthly_stats 
        ORDER BY year ASC, month_num ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    # Slice the last N months
    selected = rows[-months_count:] if len(rows) >= months_count else rows

    labels = [f"{r['month_name']}" for r in selected]
    kwh_data = [r['total_kwh'] for r in selected]
    cost_data = [r['total_cost'] for r in selected]
    target_data = [r['target_kwh'] for r in selected]

    return {
        "status": "success",
        "data": {
            "filter": f"Last {months_count} Months",
            "labels": labels,
            "datasets": [
                {
                    "label": "Energy (kWh)",
                    "data": kwh_data,
                    "borderColor": "#39e6ff",
                    "backgroundColor": "rgba(57, 230, 255, 0.15)",
                    "borderWidth": 2.5,
                    "tension": 0.4,
                    "fill": True,
                    "yAxisID": "y"
                },
                {
                    "label": "Cost (₹)",
                    "data": cost_data,
                    "borderColor": "#ffb454",
                    "backgroundColor": "rgba(255, 180, 84, 0.05)",
                    "borderWidth": 2,
                    "borderDash": [5, 5],
                    "tension": 0.3,
                    "fill": False,
                    "yAxisID": "y1"
                }
            ]
        }
    }

def get_rooms_overview():
    """Retrieves all rooms with their most recent consumption reading, cost, and status."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT 
            r.id,
            r.code,
            r.name,
            r.avatar,
            r.type,
            r.block,
            r.floor,
            r.area_sqft,
            r.ac_count,
            r.lights_count,
            r.computers_count,
            r.baseline_kwh,
            COALESCE(er.consumption_kwh, r.baseline_kwh) as consumption_kwh,
            COALESCE(er.cost_inr, r.baseline_kwh * 8.0) as cost_inr,
            COALESCE(er.peak_kw, 3.5) as peak_kw,
            COALESCE(er.status, 
                CASE 
                    WHEN r.baseline_kwh >= 350 THEN 'High'
                    WHEN r.baseline_kwh >= 250 THEN 'Medium'
                    ELSE 'Normal'
                END
            ) as status,
            er.reading_date,
            er.notes
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, consumption_kwh, cost_inr, peak_kw, status, reading_date, notes
            FROM energy_readings
            WHERE id IN (SELECT MAX(id) FROM energy_readings GROUP BY room_id)
        ) er ON r.id = er.room_id
        ORDER BY er.consumption_kwh DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    rooms_list = []
    for r in rows:
        rooms_list.append({
            "id": r["id"],
            "code": r["code"],
            "name": r["name"],
            "avatar": r["avatar"],
            "type": r["type"],
            "block": r["block"],
            "floor": r["floor"],
            "area_sqft": r["area_sqft"],
            "ac_count": r["ac_count"],
            "lights_count": r["lights_count"],
            "computers_count": r["computers_count"],
            "consumption_kwh": round(r["consumption_kwh"], 1),
            "cost_inr": round(r["cost_inr"], 2),
            "peak_kw": round(r["peak_kw"], 2),
            "status": r["status"],
            "notes": r["notes"] or ""
        })

    return {"status": "success", "count": len(rooms_list), "data": rooms_list}

def get_room_details(room_id):
    """Retrieves full details and historical reading logs for a single room."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
    room = cursor.fetchone()
    if not room:
        conn.close()
        return {"status": "error", "message": f"Room with ID {room_id} not found."}

    cursor.execute("""
        SELECT id, reading_date, month_label, consumption_kwh, cost_inr, peak_kw, status, notes
        FROM energy_readings
        WHERE room_id = ?
        ORDER BY reading_date DESC
    """, (room_id,))
    readings = cursor.fetchall()

    cursor.execute("""
        SELECT id, icon, severity, title, message, is_active, detected_at
        FROM alerts
        WHERE room_id = ?
        ORDER BY detected_at DESC
    """, (room_id,))
    alerts = cursor.fetchall()

    conn.close()

    return {
        "status": "success",
        "data": {
            "room": dict(room),
            "readings": [dict(r) for r in readings],
            "alerts": [dict(a) for a in alerts]
        }
    }

def create_room(data):
    """Adds a new campus room/lab to the database."""
    name = data.get("name", "").strip()
    if not name:
        return {"status": "error", "message": "Room name is required."}

    code = data.get("code", "").strip()
    if not code:
        # Generate code from initials
        words = name.split()
        code = "".join([w[0].upper() for w in words[:3]]) + f"-{datetime.now().strftime('%M%S')[-3:]}"

    avatar = data.get("avatar", "").strip()
    if not avatar:
        avatar = "".join([w[0].upper() for w in name.split()[:2]]) or "RM"

    room_type = data.get("type", "Laboratory")
    block = data.get("block", "Block A")
    floor = data.get("floor", "1st Floor")
    area_sqft = float(data.get("area_sqft", 800))
    ac_count = int(data.get("ac_count", 2))
    lights_count = int(data.get("lights_count", 12))
    computers_count = int(data.get("computers_count", 0))
    baseline_kwh = float(data.get("baseline_kwh", 200.0))

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO rooms (code, name, avatar, type, block, floor, area_sqft, ac_count, lights_count, computers_count, baseline_kwh)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (code, name, avatar, room_type, block, floor, area_sqft, ac_count, lights_count, computers_count, baseline_kwh))
        room_id = cursor.lastrowid

        # Also insert initial reading
        status = "High" if baseline_kwh >= HIGH_USAGE_THRESHOLD_KWH else ("Medium" if baseline_kwh >= MEDIUM_USAGE_THRESHOLD_KWH else "Normal")
        cost = baseline_kwh * TARIFF_PER_KWH
        today = datetime.now().strftime("%Y-%m-%d")
        month_label = datetime.now().strftime("%b %Y")

        cursor.execute("""
            INSERT INTO energy_readings (room_id, reading_date, month_label, consumption_kwh, cost_inr, peak_kw, status, notes)
            VALUES (?, ?, ?, ?, ?, 3.0, ?, 'Initial baseline record')
        """, (room_id, today, month_label, baseline_kwh, cost, status))

        conn.commit()
        return {"status": "success", "message": "Room created successfully.", "room_id": room_id}
    except sqlite3.IntegrityError as e:
        return {"status": "error", "message": f"Room code '{code}' already exists."}
    finally:
        conn.close()

def delete_room(room_id):
    """Deletes a room and associated readings."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    if rows_affected > 0:
        return {"status": "success", "message": f"Room {room_id} deleted successfully."}
    return {"status": "error", "message": f"Room {room_id} not found."}

def add_reading(data):
    """
    Records a new energy meter reading.
    Automatically calculates cost, classifies status, and checks for anomaly alerts.
    """
    room_id = data.get("room_id")
    consumption_kwh = float(data.get("consumption_kwh", 0))

    if not room_id or consumption_kwh <= 0:
        return {"status": "error", "message": "Valid room_id and positive consumption_kwh required."}

    cost = round(consumption_kwh * TARIFF_PER_KWH, 2)
    peak_kw = float(data.get("peak_kw", round(consumption_kwh / 60, 2)))
    notes = data.get("notes", "Meter reading")
    reading_date = data.get("reading_date", datetime.now().strftime("%Y-%m-%d"))
    month_label = datetime.now().strftime("%b %Y")

    status = "Normal"
    if consumption_kwh >= HIGH_USAGE_THRESHOLD_KWH:
        status = "High"
    elif consumption_kwh >= MEDIUM_USAGE_THRESHOLD_KWH:
        status = "Medium"

    conn = get_connection()
    cursor = conn.cursor()

    # Verify room exists
    cursor.execute("SELECT name, baseline_kwh FROM rooms WHERE id = ?", (room_id,))
    room = cursor.fetchone()
    if not room:
        conn.close()
        return {"status": "error", "message": f"Room ID {room_id} does not exist."}

    room_name = room["name"]
    baseline = room["baseline_kwh"]

    cursor.execute("""
        INSERT INTO energy_readings (room_id, reading_date, month_label, consumption_kwh, cost_inr, peak_kw, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (room_id, reading_date, month_label, consumption_kwh, cost, peak_kw, status, notes))

    reading_id = cursor.lastrowid

    # Auto Anomaly Detection: If consumption exceeds baseline by 25% or more, trigger alert!
    alert_created = False
    if baseline > 0 and (consumption_kwh - baseline) / baseline >= 0.25:
        pct_over = round(((consumption_kwh - baseline) / baseline) * 100)
        cursor.execute("""
            INSERT INTO alerts (room_id, room_name, icon, severity, title, message, is_active)
            VALUES (?, ?, '⚡', 'high', 'Automated Anomaly Detection', ?, 1)
        """, (room_id, room_name, f"Consumption spike: {pct_over}% above expected baseline ({consumption_kwh} kWh vs {baseline} kWh)."))
        alert_created = True

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": "Energy reading recorded successfully.",
        "data": {
            "reading_id": reading_id,
            "consumption_kwh": consumption_kwh,
            "cost_inr": cost,
            "status": status,
            "alert_triggered": alert_created
        }
    }

def get_alerts(active_only=True):
    """Retrieves all active or resolved energy alerts."""
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM alerts"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY detected_at DESC"

    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    alerts_list = [dict(r) for r in rows]
    return {"status": "success", "count": len(alerts_list), "data": alerts_list}

def resolve_alert(alert_id):
    """Marks an energy alert as resolved."""
    conn = get_connection()
    cursor = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE alerts 
        SET is_active = 0, resolved_at = ? 
        WHERE id = ?
    """, (now_str, alert_id))

    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    if rows_affected > 0:
        return {"status": "success", "message": f"Alert {alert_id} resolved."}
    return {"status": "error", "message": f"Alert {alert_id} not found."}

def calculate_energy(data):
    """
    Energy & Cost Calculator engine:
    Computes daily, monthly, annual kWh, cost, carbon footprint (kg CO2), 
    and returns tailored energy conservation recommendations.
    """
    appliance_name = data.get("appliance_name", "Appliance").strip() or "Appliance"
    wattage = float(data.get("wattage", 1000))
    quantity = int(data.get("quantity", 1))
    hours_per_day = float(data.get("hours_per_day", 8))
    days_per_month = int(data.get("days_per_month", 30))
    rate_per_kwh = float(data.get("rate_per_kwh", TARIFF_PER_KWH))

    # Calculations
    # kWh = (Wattage * Quantity * Hours) / 1000
    daily_kwh = round((wattage * quantity * hours_per_day) / 1000.0, 3)
    monthly_kwh = round(daily_kwh * days_per_month, 2)
    annual_kwh = round(monthly_kwh * 12, 2)

    daily_cost = round(daily_kwh * rate_per_kwh, 2)
    monthly_cost = round(monthly_kwh * rate_per_kwh, 2)
    annual_cost = round(annual_kwh * rate_per_kwh, 2)

    # Average Grid Carbon Intensity in India: ~0.82 kg CO2 per kWh
    CO2_FACTOR = 0.82
    monthly_co2_kg = round(monthly_kwh * CO2_FACTOR, 2)
    annual_co2_kg = round(annual_kwh * CO2_FACTOR, 2)

    # Calculate potential saving by reducing usage by 1 hour/day
    saved_daily_kwh = (wattage * quantity * 1.0) / 1000.0
    monthly_saved_kwh = round(saved_daily_kwh * days_per_month, 2)
    monthly_saved_cost = round(monthly_saved_kwh * rate_per_kwh, 2)

    # Save to calculation history
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO calculator_history 
        (appliance_name, wattage, quantity, hours_per_day, days_per_month, rate_per_kwh, monthly_kwh, monthly_cost, annual_co2_kg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (appliance_name, wattage, quantity, hours_per_day, days_per_month, rate_per_kwh, monthly_kwh, monthly_cost, annual_co2_kg))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "data": {
            "inputs": {
                "appliance_name": appliance_name,
                "wattage": wattage,
                "quantity": quantity,
                "hours_per_day": hours_per_day,
                "days_per_month": days_per_month,
                "rate_per_kwh": rate_per_kwh
            },
            "consumption": {
                "daily_kwh": daily_kwh,
                "monthly_kwh": monthly_kwh,
                "annual_kwh": annual_kwh
            },
            "cost": {
                "daily_inr": daily_cost,
                "monthly_inr": monthly_cost,
                "annual_inr": annual_cost
            },
            "environmental_impact": {
                "monthly_co2_kg": monthly_co2_kg,
                "annual_co2_kg": annual_co2_kg,
                "trees_equivalent_needed": round(annual_co2_kg / 21.7, 1)  # 1 mature tree absorbs ~21.7 kg CO2/yr
            },
            "optimization_tip": {
                "tip": f"Reducing '{appliance_name}' operating time by just 1 hr/day saves {monthly_saved_kwh} kWh (₹{monthly_saved_cost}) every month!"
            }
        }
    }

def get_savings_opportunities():
    """Returns smart suggestions and potential energy savings."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM savings_suggestions ORDER BY estimated_monthly_saving_inr DESC")
    rows = cursor.fetchall()

    cursor.execute("SELECT SUM(estimated_monthly_saving_inr), SUM(kwh_saved_monthly) FROM savings_suggestions WHERE is_applied = 0")
    tot = cursor.fetchone()

    conn.close()

    return {
        "status": "success",
        "total_potential_monthly_saving_inr": tot[0] or 2340.0,
        "total_potential_monthly_kwh_saved": tot[1] or 292.5,
        "suggestions": [dict(r) for r in rows]
    }

def get_analytics_breakdown():
    """Generates analytical distribution by room type, block, and appliance intensity."""
    conn = get_connection()
    cursor = conn.cursor()

    # By Room Type
    cursor.execute("""
        SELECT 
            r.type, 
            COUNT(r.id) as count,
            ROUND(SUM(COALESCE(er.consumption_kwh, r.baseline_kwh)), 1) as total_kwh,
            ROUND(SUM(COALESCE(er.cost_inr, r.baseline_kwh * 8.0)), 2) as total_cost
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, consumption_kwh, cost_inr 
            FROM energy_readings 
            WHERE id IN (SELECT MAX(id) FROM energy_readings GROUP BY room_id)
        ) er ON r.id = er.room_id
        GROUP BY r.type
        ORDER BY total_kwh DESC
    """)
    by_type = [dict(r) for r in cursor.fetchall()]

    # By Block
    cursor.execute("""
        SELECT 
            r.block,
            ROUND(SUM(COALESCE(er.consumption_kwh, r.baseline_kwh)), 1) as total_kwh,
            ROUND(SUM(COALESCE(er.cost_inr, r.baseline_kwh * 8.0)), 2) as total_cost
        FROM rooms r
        LEFT JOIN (
            SELECT room_id, consumption_kwh, cost_inr 
            FROM energy_readings 
            WHERE id IN (SELECT MAX(id) FROM energy_readings GROUP BY room_id)
        ) er ON r.id = er.room_id
        GROUP BY r.block
        ORDER BY total_kwh DESC
    """)
    by_block = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "status": "success",
        "data": {
            "by_room_type": by_type,
            "by_block": by_block,
            "carbon_intensity_factor": 0.82,
            "estimated_monthly_carbon_footprint_kg": round(1842.0 * 0.82, 1)
        }
    }

def get_reports_summary():
    """Returns an executive energy audit report for export/presentation."""
    summary = get_dashboard_summary()["data"]
    rooms = get_rooms_overview()["data"]
    analytics = get_analytics_breakdown()["data"]

    return {
        "status": "success",
        "report_generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "institution": "Campus Energy Detective",
        "audit_summary": summary,
        "high_consumption_rooms": [r for r in rooms if r["status"] == "High"],
        "department_distribution": analytics["by_room_type"],
        "recommended_interventions": [
            "Mandate 24°C AC setpoint in auditorium and seminar halls.",
            "Install occupancy timers on lab computer banks.",
            "Conduct power factor audit on workshop transformers."
        ]
    }

# Run initialization upon module import
init_db()
