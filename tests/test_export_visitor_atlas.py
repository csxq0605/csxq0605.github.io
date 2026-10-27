"""Tests for scripts/export_visitor_atlas.py. Run: python3 -m unittest discover tests"""
import contextlib
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import export_visitor_atlas as exporter  # noqa: E402

PAGES = [
    {"stats": [{"id": "CN", "name": "China", "count": 10}, {"id": "", "name": "(unknown)", "count": 3}], "more": True},
    {"stats": [{"id": "US", "name": "United States", "count": 4}, {"id": "cn", "name": "China", "count": 2}], "more": False},
]


@contextlib.contextmanager
def _capture_stderr():
    buf, old = io.StringIO(), sys.stderr
    sys.stderr = buf
    try:
        yield buf
    finally:
        sys.stderr = old


class FakeGoatCounter(BaseHTTPRequestHandler):
    status = 200
    error_body = b""
    seen = []

    def do_GET(self):
        url = urlparse(self.path)
        query = parse_qs(url.query)
        FakeGoatCounter.seen.append((url.path, query, self.headers.get("Authorization")))
        if self.status != 200:
            self.send_response(self.status)
            self.end_headers()
            self.wfile.write(self.error_body)
            return
        body = json.dumps(PAGES[int(query["offset"][0]) // exporter.PAGE_SIZE]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class ExportTest(unittest.TestCase):
    def setUp(self):
        FakeGoatCounter.status, FakeGoatCounter.error_body, FakeGoatCounter.seen = 200, b"", []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeGoatCounter)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = "http://127.0.0.1:{}".format(self.server.server_port)
        self.tmp = tempfile.TemporaryDirectory()
        self.config = Path(self.tmp.name, "analytics.json")
        self.output = Path(self.tmp.name, "atlas.json")
        os.environ["GOATCOUNTER_API_TOKEN"] = "test-token"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()
        os.environ.pop("GOATCOUNTER_API_TOKEN", None)

    def run_export(self, site="example", start="2026-10-01"):
        self.config.write_text(json.dumps({"goatcounter_site": site, "start_date": start}))
        return exporter.main(["--config", str(self.config), "--output", str(self.output), "--api-base", self.base])

    def test_pages_merged_and_unknown_counted(self):
        self.assertEqual(self.run_export(), 0)
        atlas = json.loads(self.output.read_text())
        self.assertEqual([(r["code"], r["visits"]) for r in atlas["regions"]], [("CN", 12), ("US", 4)])
        self.assertEqual(atlas["unlocated_visits"], 3)
        self.assertEqual(atlas["period_start"], "2026-10-01")
        self.assertTrue(all({"name", "lat", "lng"} <= set(r) for r in atlas["regions"]))
        path, query, auth = FakeGoatCounter.seen[0]
        self.assertEqual(path, "/api/v0/stats/locations")
        self.assertEqual(query["start"], ["2026-10-01T00:00:00Z"])
        self.assertEqual(auth, "Bearer test-token")
        self.assertEqual([q["offset"] for _, q, _ in FakeGoatCounter.seen], [["0"], ["100"]])

    def test_not_configured_is_a_quiet_no_op(self):
        self.assertEqual(self.run_export(site=""), 0)
        self.assertFalse(self.output.exists())
        self.assertEqual(FakeGoatCounter.seen, [])

    def test_missing_token_fails(self):
        os.environ.pop("GOATCOUNTER_API_TOKEN")
        self.assertEqual(self.run_export(), 1)

    def test_server_error_keeps_previous_file(self):
        self.output.write_text("previous")
        FakeGoatCounter.status = 500
        self.assertEqual(self.run_export(), 1)
        self.assertEqual(self.output.read_text(), "previous")

    def test_api_error_message_is_reported_without_the_token(self):
        FakeGoatCounter.status = 404
        FakeGoatCounter.error_body = json.dumps({"error": "not found: test-token"}).encode()
        with _capture_stderr() as err:
            self.assertEqual(self.run_export(), 1)
        self.assertIn("HTTP 404: not found: ***", err.getvalue())
        self.assertNotIn("test-token", err.getvalue())

    def test_invalid_count_rejected(self):
        with self.assertRaises(ValueError):
            exporter.build_atlas([{"id": "CN", "count": -1}], {"CN": {"name": "China", "lat": 0, "lng": 0}}, "", datetime.now(timezone.utc))


if __name__ == "__main__":
    unittest.main()
