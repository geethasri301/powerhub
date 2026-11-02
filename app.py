"""
Campus Energy Detective - Flask Application Alternative
========================================================
Flask REST API server for users / evaluation environments
that utilize the Flask framework.
Uses the same shared SQLite database and business logic in database.py.

Install requirements:
    pip install -r requirements.txt
Run:
    python app.py
"""

import os
from flask import Flask, request, jsonify, send_from_directory
import database

app = Flask(__name__, static_folder=".", static_url_path="")
database.init_db()

# Enable CORS manually for all responses
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    return response

# Serve Frontend
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(".", path)

# REST API Endpoints
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Campus Energy Detective API (Flask)",
        "version": "1.0.0"
    })

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():
    return jsonify(database.get_dashboard_summary())

@app.route("/api/dashboard/chart", methods=["GET"])
def get_chart():
    filter_val = request.args.get("filter", "6")
    months = 12 if "12" in str(filter_val) else 6
    return jsonify(database.get_chart_data(months))

@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    return jsonify(database.get_rooms_overview())

@app.route("/api/rooms/<int:room_id>", methods=["GET"])
def get_room(room_id):
    res = database.get_room_details(room_id)
    status_code = 200 if res.get("status") == "success" else 404
    return jsonify(res), status_code

@app.route("/api/rooms", methods=["POST"])
def create_room():
    data = request.get_json() or {}
    res = database.create_room(data)
    status_code = 201 if res.get("status") == "success" else 400
    return jsonify(res), status_code

@app.route("/api/rooms/<int:room_id>", methods=["DELETE"])
def delete_room(room_id):
    res = database.delete_room(room_id)
    status_code = 200 if res.get("status") == "success" else 404
    return jsonify(res), status_code

@app.route("/api/readings", methods=["POST"])
def add_reading():
    data = request.get_json() or {}
    res = database.add_reading(data)
    status_code = 201 if res.get("status") == "success" else 400
    return jsonify(res), status_code

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    active_only = request.args.get("active", "true").lower() != "false"
    return jsonify(database.get_alerts(active_only))

@app.route("/api/alerts/<int:alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    res = database.resolve_alert(alert_id)
    status_code = 200 if res.get("status") == "success" else 404
    return jsonify(res), status_code

@app.route("/api/calculator", methods=["POST"])
def calculate_energy():
    data = request.get_json() or {}
    return jsonify(database.calculate_energy(data))

@app.route("/api/savings", methods=["GET"])
def get_savings():
    return jsonify(database.get_savings_opportunities())

@app.route("/api/analytics", methods=["GET"])
def get_analytics():
    return jsonify(database.get_analytics_breakdown())

@app.route("/api/reports/summary", methods=["GET"])
def get_reports():
    return jsonify(database.get_reports_summary())

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f" * Starting Flask server at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
