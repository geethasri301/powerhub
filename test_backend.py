"""
Campus Energy Detective - Backend Unit & Integration Tests
==========================================================
Tests database CRUD operations, business logic, calculations,
anomaly detection, and report generation.
"""

import unittest
import database

class TestCampusEnergyBackend(unittest.TestCase):

    def setUp(self):
        database.init_db()

    def test_dashboard_summary(self):
        res = database.get_dashboard_summary()
        self.assertEqual(res["status"], "success")
        data = res["data"]
        self.assertIn("total_energy_kwh", data)
        self.assertIn("total_cost_inr", data)
        self.assertIn("high_usage_rooms", data)
        self.assertIn("efficiency_score", data)
        self.assertGreater(data["total_energy_kwh"], 0)
        self.assertGreater(data["total_cost_inr"], 0)

    def test_chart_data(self):
        # 6 months
        res6 = database.get_chart_data(6)
        self.assertEqual(res6["status"], "success")
        self.assertEqual(len(res6["data"]["labels"]), 6)
        self.assertEqual(len(res6["data"]["datasets"][0]["data"]), 6)

        # 12 months
        res12 = database.get_chart_data(12)
        self.assertEqual(res12["status"], "success")
        self.assertEqual(len(res12["data"]["labels"]), 12)

    def test_rooms_overview(self):
        res = database.get_rooms_overview()
        self.assertEqual(res["status"], "success")
        self.assertGreaterEqual(res["count"], 4)
        first_room = res["data"][0]
        self.assertIn("name", first_room)
        self.assertIn("consumption_kwh", first_room)
        self.assertIn("cost_inr", first_room)
        self.assertIn("status", first_room)
        self.assertIn(first_room["status"], ["Normal", "Medium", "High"])

    def test_room_crud(self):
        # Create
        new_room = {
            "name": "Robotics Research Center",
            "code": "RRC-TEST",
            "avatar": "RR",
            "type": "Laboratory",
            "block": "Block C",
            "baseline_kwh": 310.0
        }
        create_res = database.create_room(new_room)
        self.assertEqual(create_res["status"], "success")
        room_id = create_res["room_id"]

        # Read details
        detail_res = database.get_room_details(room_id)
        self.assertEqual(detail_res["status"], "success")
        self.assertEqual(detail_res["data"]["room"]["name"], "Robotics Research Center")

        # Delete
        del_res = database.delete_room(room_id)
        self.assertEqual(del_res["status"], "success")

    def test_reading_with_anomaly_detection(self):
        # Add reading that exceeds baseline (>25% spike)
        reading_data = {
            "room_id": 1,
            "consumption_kwh": 650.0,
            "notes": "Testing energy surge during weekend hackathon"
        }
        res = database.add_reading(reading_data)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["data"]["status"], "High")
        self.assertTrue(res["data"]["alert_triggered"])

    def test_calculator_engine(self):
        calc_input = {
            "appliance_name": "Split Air Conditioner 1.5 Ton",
            "wattage": 1500,
            "quantity": 2,
            "hours_per_day": 8,
            "days_per_month": 30,
            "rate_per_kwh": 8.00
        }
        res = database.calculate_energy(calc_input)
        self.assertEqual(res["status"], "success")
        data = res["data"]
        # Daily kWh = (1500 * 2 * 8) / 1000 = 24.0 kWh
        self.assertEqual(data["consumption"]["daily_kwh"], 24.0)
        # Monthly kWh = 24 * 30 = 720.0 kWh
        self.assertEqual(data["consumption"]["monthly_kwh"], 720.0)
        # Monthly Cost = 720 * 8 = 5760.0 INR
        self.assertEqual(data["cost"]["monthly_inr"], 5760.0)
        # Carbon impact check
        self.assertGreater(data["environmental_impact"]["monthly_co2_kg"], 0)

    def test_savings_and_analytics(self):
        savings = database.get_savings_opportunities()
        self.assertEqual(savings["status"], "success")
        self.assertGreater(len(savings["suggestions"]), 0)

        analytics = database.get_analytics_breakdown()
        self.assertEqual(analytics["status"], "success")
        self.assertIn("by_room_type", analytics["data"])
        self.assertIn("by_block", analytics["data"])

    def test_reports(self):
        report = database.get_reports_summary()
        self.assertEqual(report["status"], "success")
        self.assertIn("audit_summary", report)
        self.assertIn("high_consumption_rooms", report)

if __name__ == "__main__":
    unittest.main()
