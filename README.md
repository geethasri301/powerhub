# ⚡ Campus Energy Detective

An Intelligent Campus Energy Auditing & Anomaly Monitoring System designed to track, calculate, analyze, and optimize institutional electricity consumption.

---

## 🌟 Overview & Highlights

- **Live Aggregated Metrics**: Real-time calculation of campus kWh, electricity spend (₹), high-usage room alerts, and potential rupee savings.
- **Automated Anomaly Detection**: Automatically flags consumption spikes exceeding baseline limits (>25%) and generates actionable alerts for facilities managers.
- **Interactive Energy & Cost Calculator**: Computes daily, monthly, and annual energy usage, rupee billing at standard campus tariffs, and environmental carbon footprint ($CO_2$ kg).
- **Dual Backend Options**:
  1. **Zero-Dependency Native Python Server (`server.py`)**: Runs directly on any machine with standard Python 3. No `pip install` required!
  2. **Flask REST API (`app.py`)**: For academic evaluation environments requiring Flask.
- **Relational Database (`campus_energy.db`)**: Pre-seeded SQLite database with foreign keys, indexes, and full historical campus trend logs.
- **RESTful API**: Standardized JSON endpoints for all CRUD operations on rooms, meter readings, alerts, and calculations.

---

## 📂 Project Structure

```text
major project/
├── index.html          # Campus dashboard frontend (HTML5)
├── style.css           # Modern theme styling & modal dialogs
├── script.js           # Frontend controller & REST API client
├── database.py         # SQLite schema, business logic & anomaly detection
├── server.py           # Standalone multi-threaded Python HTTP/REST server (0 dependencies)
├── app.py              # Flask backend alternative
├── requirements.txt    # Optional dependencies for Flask mode
├── test_backend.py     # Automated unit & integration tests
├── campus_energy.db    # SQLite relational database (auto-generated)
└── README.md           # Complete project documentation
```

---

## 🚀 How to Run

### Option 1: Standard Python Server (Recommended — Zero Setup)

Works out of the box with Python 3 (no third-party packages needed):

```bash
python server.py
```

Then open your browser and go to:
**[http://localhost:5000](http://localhost:5000)**

---

### Option 2: Flask Server

If your course requires Flask:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start Flask
python app.py
```

Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 🧪 Running Automated Tests

To verify database integrity, CRUD operations, calculator formulas, and anomaly detection:

```bash
python test_backend.py
```

All 8 tests cover:
- Dashboard KPI aggregation
- 6-month and 12-month trend slicing
- Room CRUD operations
- Meter reading logging with automated anomaly detection
- Mathematical accuracy of the Energy & Cost Calculator
- Carbon emissions calculation
- Executive energy audit report generation

---

## 📡 REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health status & Python version |
| `GET` | `/api/dashboard` | Aggregated dashboard stats (kWh, cost, alert counts) |
| `GET` | `/api/dashboard/chart?filter=6` | Historical consumption data formatted for Chart.js |
| `GET` | `/api/rooms` | All rooms with latest meter readings & status |
| `GET` | `/api/rooms/<id>` | Specific room details, appliance breakdown, and logs |
| `POST` | `/api/rooms` | Add a new campus room/lab |
| `DELETE` | `/api/rooms/<id>` | Delete a room record |
| `POST` | `/api/readings` | Record meter reading (auto-triggers anomaly alert on spike) |
| `GET` | `/api/alerts` | Active or historical energy anomalies |
| `POST` | `/api/alerts/<id>/resolve` | Mark an alert as resolved |
| `POST` | `/api/calculator` | Calculate appliance energy, cost, and $CO_2$ footprint |
| `GET` | `/api/savings` | Smart conservation recommendations & ₹ savings |
| `GET` | `/api/analytics` | Facility-type breakdown & carbon intensity metrics |
| `GET` | `/api/reports/summary` | Executive audit summary ready for print / export |

---

## 🧮 Mathematical Formulas Implemented

### 1. Energy Consumption Formula
$$\text{Daily kWh} = \frac{\text{Wattage} \times \text{Quantity} \times \text{Hours Run}}{1000}$$

$$\text{Monthly kWh} = \text{Daily kWh} \times \text{Days per Month}$$

### 2. Electricity Cost Formula
$$\text{Cost (₹)} = \text{Consumption (kWh)} \times \text{Tariff Rate (₹/kWh)}$$
*(Standard campus commercial tariff: ₹8.00 / kWh)*

### 3. Environmental Impact ($CO_2$ Footprint)
$$\text{Carbon Emissions (kg } CO_2) = \text{Energy (kWh)} \times 0.82 \text{ kg } CO_2/\text{kWh}$$
*(Based on the average grid carbon emission factor for India)*

### 4. Anomaly Detection Rule
$$\text{Spike Percentage} = \frac{\text{Current Reading} - \text{Baseline}}{\text{Baseline}} \times 100$$
- If Spike $\ge 25\%$, the system automatically triggers a **High-Severity Anomaly Alert** and flags the room.

---

## 🎓 Viva / Project Defense Q&A

**Q1: Why SQLite instead of traditional client-server MySQL for this major project?**  
> *A: SQLite provides a zero-configuration, self-contained, serverless, ACID-compliant relational database. It ensures that the project runs immediately on any examiner's computer without requiring local MySQL daemon setup or password credentials.*

**Q2: How does the system detect energy anomalies?**  
> *A: Each room has a baseline monthly consumption determined by its square footage, AC count, and computer equipment. Whenever a meter reading exceeds this baseline by 25% or more, `add_reading()` automatically creates a timestamped entry in the `alerts` table.*

**Q3: How does the frontend stay in sync with the backend?**  
> *A: The frontend uses asynchronous `fetch()` API calls against `/api/dashboard`, `/api/dashboard/chart`, and `/api/rooms`. When an alert is resolved or a new room/reading is added, `script.js` updates the UI instantly.*
