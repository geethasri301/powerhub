"""
Campus Energy Detective - Backend REST API & Web Server
======================================================
High-performance, multi-threaded HTTP server and REST API built with
Python's standard library. Zero external dependencies required.

Run:
    python server.py
Then open:
    http://localhost:5000
"""

import sys
import os
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs
import database

PORT = int(os.environ.get("PORT", 5000))
HOST = "0.0.0.0"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handles requests in a separate thread for high concurrency."""
    daemon_threads = True
    allow_reuse_address = True

class EnergyDetectiveRequestHandler(BaseHTTPRequestHandler):

    def _send_cors_headers(self):
        """Attaches CORS headers to allow cross-origin requests."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _send_json_response(self, data, status_code=200):
        """Sends a JSON response with proper headers."""
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(response_bytes)

    def _send_file_response(self, filepath, content_type):
        """Sends a static file from disk."""
        if not os.path.exists(filepath):
            self._send_json_response({"status": "error", "message": "File not found"}, 404)
            return

        with open(filepath, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(content)

    def _parse_json_body(self):
        """Reads and parses incoming JSON payload from request body."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                return {}
            body_bytes = self.rfile.read(content_length)
            return json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            return None

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    # ==========================================================================
    # GET Endpoints
    # ==========================================================================
    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        # ---------------- Static Files ----------------
        if path in ("/", "/index.html"):
            return self._send_file_response(os.path.join(BASE_DIR, "index.html"), "text/html; charset=utf-8")
        elif path == "/style.css":
            return self._send_file_response(os.path.join(BASE_DIR, "style.css"), "text/css; charset=utf-8")
        elif path == "/script.js":
            return self._send_file_response(os.path.join(BASE_DIR, "script.js"), "application/javascript; charset=utf-8")

        # ---------------- REST API Endpoints ----------------
        # 1. Health check
        if path == "/api/health":
            return self._send_json_response({
                "status": "healthy",
                "service": "Campus Energy Detective API",
                "version": "1.0.0",
                "python_version": sys.version
            })

        # 2. Dashboard summary
        elif path == "/api/dashboard":
            return self._send_json_response(database.get_dashboard_summary())

        # 3. Chart data
        elif path == "/api/dashboard/chart":
            filter_val = query_params.get("filter", ["6"])[0]
            months = 12 if "12" in str(filter_val) else 6
            return self._send_json_response(database.get_chart_data(months))

        # 4. Rooms list
        elif path == "/api/rooms":
            return self._send_json_response(database.get_rooms_overview())

        # 5. Single room details: /api/rooms/<id>
        elif re.match(r"^/api/rooms/(\d+)$", path):
            room_id = int(re.match(r"^/api/rooms/(\d+)$", path).group(1))
            res = database.get_room_details(room_id)
            status_code = 200 if res.get("status") == "success" else 404
            return self._send_json_response(res, status_code)

        # 6. Alerts list
        elif path == "/api/alerts":
            active_only = query_params.get("active", ["true"])[0].lower() != "false"
            return self._send_json_response(database.get_alerts(active_only))

        # 7. Savings suggestions
        elif path == "/api/savings":
            return self._send_json_response(database.get_savings_opportunities())

        # 8. Analytics breakdown
        elif path == "/api/analytics":
            return self._send_json_response(database.get_analytics_breakdown())

        # 9. Reports summary
        elif path == "/api/reports/summary":
            return self._send_json_response(database.get_reports_summary())

        # 404 for unknown endpoints
        return self._send_json_response({
            "status": "error",
            "message": f"Endpoint '{path}' not found."
        }, 404)

    # ==========================================================================
    # POST Endpoints
    # ==========================================================================
    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        body = self._parse_json_body()

        if body is None:
            return self._send_json_response({"status": "error", "message": "Invalid JSON payload."}, 400)

        # 1. Create Room: POST /api/rooms
        if path == "/api/rooms":
            res = database.create_room(body)
            status_code = 201 if res.get("status") == "success" else 400
            return self._send_json_response(res, status_code)

        # 2. Record Energy Reading: POST /api/readings
        elif path == "/api/readings":
            res = database.add_reading(body)
            status_code = 201 if res.get("status") == "success" else 400
            return self._send_json_response(res, status_code)

        # 3. Energy Calculator: POST /api/calculator
        elif path == "/api/calculator":
            res = database.calculate_energy(body)
            return self._send_json_response(res, 200)

        # 4. Resolve Alert: POST /api/alerts/<id>/resolve
        elif re.match(r"^/api/alerts/(\d+)/resolve$", path):
            alert_id = int(re.match(r"^/api/alerts/(\d+)/resolve$", path).group(1))
            res = database.resolve_alert(alert_id)
            status_code = 200 if res.get("status") == "success" else 404
            return self._send_json_response(res, status_code)

        # 404
        return self._send_json_response({"status": "error", "message": f"Endpoint '{path}' not found."}, 404)

    # ==========================================================================
    # DELETE Endpoints
    # ==========================================================================
    def do_DELETE(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Delete Room: DELETE /api/rooms/<id>
        match = re.match(r"^/api/rooms/(\d+)$", path)
        if match:
            room_id = int(match.group(1))
            res = database.delete_room(room_id)
            status_code = 200 if res.get("status") == "success" else 404
            return self._send_json_response(res, status_code)

        return self._send_json_response({"status": "error", "message": f"Endpoint '{path}' not found."}, 404)

    def log_message(self, format, *args):
        """Custom log format for incoming requests."""
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run(port=PORT):
    # Ensure stdout/stderr handles UTF-8 on Windows
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr and hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    database.init_db()
    server_address = (HOST, port)
    httpd = ThreadedHTTPServer(server_address, EnergyDetectiveRequestHandler)
    print("=" * 65)
    print(" [CAMPUS ENERGY DETECTIVE] BACKEND SERVER STARTED")
    print("=" * 65)
    print(f" -> Local URL:       http://localhost:{port}")
    print(f" -> REST API Base:   http://localhost:{port}/api")
    print(f" -> SQLite Database: {database.DB_FILE}")
    print("=" * 65)
    print(" REST API Endpoints Available:")
    print("  * GET  /api/health")
    print("  * GET  /api/dashboard")
    print("  * GET  /api/dashboard/chart?filter=6months|12months")
    print("  * GET  /api/rooms")
    print("  * GET  /api/rooms/<id>")
    print("  * POST /api/rooms")
    print("  * DEL  /api/rooms/<id>")
    print("  * POST /api/readings")
    print("  * GET  /api/alerts")
    print("  * POST /api/alerts/<id>/resolve")
    print("  * POST /api/calculator")
    print("  * GET  /api/savings")
    print("  * GET  /api/analytics")
    print("  * GET  /api/reports/summary")
    print("=" * 65)
    print(" Press Ctrl+C to stop the server.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n Shutting down Campus Energy Detective Server.")
        httpd.server_close()

if __name__ == "__main__":
    run()
