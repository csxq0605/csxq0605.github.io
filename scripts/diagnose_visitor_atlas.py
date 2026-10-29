#!/usr/bin/env python3
"""Compare GoatCounter authentication and date ranges without publishing data.

Uses the existing GOATCOUNTER_API_TOKEN secret. Account responses and statistics
are not printed; only request metadata, status and sanitized error messages are.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from export_visitor_atlas import ROOT, api_error, load_config, safe_message


def probe_cases(start, now, replay_end=None):
    end = now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start_time = datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc) if start else None
    cases = [("authentication", "/api/v0/me")]
    ranges = [("locations-current", "locations", end),
              ("locations-24h-earlier", "locations", end - timedelta(days=1)),
              ("locations-completed-utc-day", "locations", end.replace(hour=0)),
              ("total-current", "total", end)]
    if replay_end:
        cutoff = datetime.strptime(replay_end, "%Y-%m-%dT%H:00:00Z").replace(tzinfo=timezone.utc)
        if start_time and cutoff <= start_time:
            raise ValueError("Replay end must be after the configured start date")
        if cutoff > end:
            raise ValueError("Replay end must not be in the future")
        ranges.append(("locations-replay-failed-window", "locations", cutoff))
    for label, endpoint, cutoff in ranges:
        if start_time and cutoff <= start_time:
            continue
        query = {"end": cutoff.strftime("%Y-%m-%dT%H:00:00Z")}
        if start_time:
            query["start"] = start_time.strftime("%Y-%m-%dT%H:00:00Z")
        if endpoint == "locations":
            # Match the exporter exactly, including pagination, when replaying.
            query.update(limit=100, offset=0)
        cases.append((label, "/api/v0/stats/" + endpoint + "?" + urllib.parse.urlencode(query)))
    return cases


def probe(base, token, label, path, opener=urllib.request.urlopen):
    url = base + path
    result = {"case": label, "request_url": url}
    request = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json", "Content-Type": "application/json",
        "User-Agent": "csxq0605.github.io visitor-atlas",
    })
    try:
        with opener(request, timeout=15) as response:
            result.update(status=response.status,
                          response_url=safe_message(response.geturl(), token),
                          content_type=response.headers.get("Content-Type", ""))
            # Deliberately do not read /me or statistics payloads.
    except urllib.error.HTTPError as error:
        result.update(status=error.code, response_url=safe_message(error.geturl(), token),
                      error=api_error(error, token))
        error.close()
    except (urllib.error.URLError, OSError) as error:
        result.update(status=None, error=safe_message(error, token))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replay-end", default=os.environ.get("REPLAY_END", ""),
                        help="UTC hour from a failed request, e.g. 2026-10-28T23:00:00Z")
    args = parser.parse_args()
    site, start = load_config(ROOT / "_data" / "analytics.json")
    token = os.environ.get("GOATCOUNTER_API_TOKEN", "").strip()
    if not site or not token:
        print("Diagnostic requires a configured site and GOATCOUNTER_API_TOKEN.", file=sys.stderr)
        return 1
    now = datetime.now(timezone.utc)
    try:
        cases = probe_cases(start, now, args.replay_end)
    except ValueError as error:
        print("Invalid diagnostic date: {}".format(error), file=sys.stderr)
        return 1
    print(json.dumps({"checked_at": now.isoformat(), "site": site,
                      "event": os.environ.get("GITHUB_EVENT_NAME"),
                      "attempt": os.environ.get("GITHUB_RUN_ATTEMPT")}))
    failed = False
    for index, (label, path) in enumerate(cases):
        if index:
            time.sleep(1)
        result = probe("https://{}.goatcounter.com".format(site), token, label, path)
        print(json.dumps(result, ensure_ascii=False), flush=True)
        failed |= result["status"] != 200
    # All cases are printed before failing; no snapshot is changed.
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
