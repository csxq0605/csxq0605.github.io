import io
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import diagnose_visitor_atlas as diagnostic


class DiagnosticTest(unittest.TestCase):
    def test_replay_uses_the_failed_requests_exact_parameters(self):
        cases = dict(diagnostic.probe_cases('2026-10-26', datetime(2026, 10, 29, 6, 41, tzinfo=timezone.utc),
                                           '2026-10-28T23:00:00Z'))
        query = parse_qs(urlsplit(cases['locations-replay-failed-window']).query)
        self.assertEqual(query, {'start': ['2026-10-26T00:00:00Z'], 'end': ['2026-10-28T23:00:00Z'],
                                 'limit': ['100'], 'offset': ['0']})

    def test_invalid_replay_dates_are_rejected_before_requests(self):
        now = datetime(2026, 10, 29, 6, 41, tzinfo=timezone.utc)
        for value in ['2026-10-30T00:00:00Z', '2026-10-26T00:00:00Z', 'invalid']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                diagnostic.probe_cases('2026-10-26', now, value)

    def test_ranges_are_frozen_and_only_end_changes_for_country_queries(self):
        cases = dict(diagnostic.probe_cases("2026-10-26", datetime(2026, 10, 29, 23, 17, tzinfo=timezone.utc)))
        expected = {"locations-current": "2026-10-29T23:00:00Z",
                    "locations-24h-earlier": "2026-10-28T23:00:00Z",
                    "locations-completed-utc-day": "2026-10-29T00:00:00Z"}
        for name, end in expected.items():
            query = parse_qs(urlsplit(cases[name]).query)
            self.assertEqual(query['start'], ['2026-10-26T00:00:00Z'])
            self.assertEqual(query['end'], [end])
        self.assertEqual(cases['authentication'], '/api/v0/me')

    def test_new_sites_do_not_query_before_collection_started(self):
        cases = dict(diagnostic.probe_cases("2026-10-29", datetime(2026, 10, 29, 23, 17, tzinfo=timezone.utc)))
        self.assertNotIn('locations-24h-earlier', cases)
        self.assertNotIn('locations-completed-utc-day', cases)

    def test_authentication_success_does_not_read_private_body(self):
        class Response(io.StringIO):
            status = 200
            headers = {'Content-Type': 'application/json'}
            def geturl(self):
                return 'https://example.goatcounter.com/api/v0/me'
            def read(self, *args):
                raise AssertionError('Account response must not be read')
        result = diagnostic.probe('https://example.goatcounter.com', 'secret-token', 'authentication', '/api/v0/me',
                                  opener=lambda *a, **kw: Response('{"email":"private@example.com"}'))
        self.assertEqual(result['status'], 200)
        self.assertNotIn('private@example.com', json.dumps(result))

    def test_failed_probe_reports_original_status_without_token(self):
        def fail(*args, **kwargs):
            raise HTTPError('https://example.goatcounter.com/api/v0/me', 404, 'not found', {},
                            io.BytesIO(b'{"error":"not found: secret-token"}'))
        result = diagnostic.probe('https://example.goatcounter.com', 'secret-token', 'authentication', '/api/v0/me', opener=fail)
        self.assertEqual(result['status'], 404)
        self.assertEqual(result['error'], 'not found: ***')
        self.assertNotIn('secret-token', json.dumps(result))
