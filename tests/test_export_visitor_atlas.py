"""Tests for scripts/export_visitor_atlas.py. Run: python3 -m unittest discover tests"""
import contextlib
import io
import json
import os
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
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
        sleep_patch = patch.object(exporter.time, "sleep")
        self.sleep = sleep_patch.start()
        self.addCleanup(sleep_patch.stop)
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
        self.output.write_text("previous")
        FakeGoatCounter.status = 404
        FakeGoatCounter.error_body = json.dumps({"error": "not found: test-token"}).encode()
        with _capture_stderr() as err:
            self.assertEqual(self.run_export(), 1)
        self.assertIn("HTTP 404: not found: ***", err.getvalue())
        self.assertNotIn("test-token", err.getvalue())
        self.assertEqual(self.output.read_text(), "previous")

    def test_invalid_count_rejected(self):
        with self.assertRaises(ValueError):
            exporter.build_atlas([{"id": "CN", "count": -1}], {"CN": {"name": "China", "lat": 0, "lng": 0}}, "", datetime.now(timezone.utc))


class RetryTest(unittest.TestCase):
    def fetch(self, responses):
        self.urls, self.delays = [], []
        responses = iter(responses)

        def open_response(request, timeout):
            self.urls.append(request.full_url)
            item = next(responses)
            if isinstance(item, Exception):
                raise item
            response = io.StringIO(json.dumps(item))
            response.status = 200
            return response

        return exporter.fetch_locations("https://example.goatcounter.com", "test-token", "2026-10-26",
                                        "2026-10-29T00:00:00Z", opener=open_response, sleep=self.delays.append)

    @staticmethod
    def error(code, headers=None):
        return HTTPError("https://example.goatcounter.com/api/v0/stats/locations", code, "not found",
                         headers or {}, io.BytesIO(b'{"error":"not found: test-token"}'))

    def test_transient_404_retries_same_page_without_duplicate_rows(self):
        rows = self.fetch([PAGES[0], self.error(404), PAGES[1]])
        self.assertEqual(rows, PAGES[0]["stats"] + PAGES[1]["stats"])
        self.assertEqual(self.delays, [5])
        self.assertEqual(self.urls[1], self.urls[2])

    def test_persistent_404_probes_auth_without_logging_private_response(self):
        with _capture_stderr() as err, self.assertRaisesRegex(ValueError, "HTTP 404"):
            self.fetch([self.error(404) for _ in range(3)] + [{"email": "private@example.com", "token": "test-token"}])
        self.assertEqual(self.delays, [5, 15])
        self.assertTrue(self.urls[-1].endswith('/api/v0/me'))
        self.assertIn('Diagnostic GET /api/v0/me: HTTP 200', err.getvalue())
        self.assertNotIn('private@example.com', err.getvalue())
        self.assertNotIn('test-token', err.getvalue())

    def test_auth_errors_fail_immediately(self):
        for code in (401, 403):
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, str(code)):
                self.fetch([self.error(code)])
            self.assertEqual(len(self.urls), 1)
            self.assertEqual(self.delays, [])

    def test_connection_and_server_errors_can_recover(self):
        rows = self.fetch([URLError('temporary connection error'), self.error(503), PAGES[0], PAGES[1]])
        self.assertEqual(len(rows), 4)
        self.assertEqual(self.delays, [5, 15])

    def test_persistent_connection_errors_stop_without_leaking_token(self):
        with _capture_stderr() as err, self.assertRaises(ValueError) as failure:
            self.fetch([URLError('connection error: test-token') for _ in range(3)])
        self.assertEqual(len(self.urls), 3)
        self.assertEqual(self.delays, [5, 15])
        self.assertNotIn('test-token', str(failure.exception) + err.getvalue())

    def test_rate_limit_wait_is_bounded_and_tolerates_bad_header(self):
        self.fetch([self.error(429, {"X-Rate-Limit-Reset": "99999999"}),
                    self.error(429, {"X-Rate-Limit-Reset": "invalid"}), PAGES[0], PAGES[1]])
        self.assertEqual(self.delays, [60, 15])


if __name__ == "__main__":
    unittest.main()
