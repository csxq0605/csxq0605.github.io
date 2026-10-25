#!/usr/bin/env python3
"""Export per-country visitor totals from GoatCounter for the /explore/ map.

Reads the GoatCounter site name and start date from _data/analytics.json and the
API token from the GOATCOUNTER_API_TOKEN environment variable. Writes a small
public JSON file with country totals only, never IP addresses or paths:

    {"updated_at": "...Z", "period_start": "YYYY-MM-DD", "unlocated_visits": 3,
     "regions": [{"code": "CN", "name": "China", "lat": 35.0, "lng": 105.0, "visits": 12}]}

Exit codes: 0 written or counting not configured (prints why); 1 on error, in
which case nothing is written so the last good file stays published.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CENTROIDS = Path(__file__).resolve().parent / "data" / "country-centroids.json"
PAGE_SIZE = 100
MAX_PAGES = 10  # 1,000 rows is far more than there are countries


def load_config(path):
    config = json.loads(Path(path).read_text())
    site = (config.get("goatcounter_site") or "").strip()
    start = (config.get("start_date") or "").strip()
    if start:
        datetime.strptime(start, "%Y-%m-%d")  # validate
    return site, start


def fetch_locations(base_url, token, start, end, opener=urllib.request.urlopen, sleep=time.sleep):
    """Return GoatCounter location rows across all pages."""
    rows = []
    for page in range(MAX_PAGES):
        query = {"limit": PAGE_SIZE, "offset": page * PAGE_SIZE, "end": end}
        if start:
            query["start"] = start + "T00:00:00Z"
        url = base_url.rstrip("/") + "/api/v0/stats/locations?" + urllib.parse.urlencode(query)
        request = urllib.request.Request(url, headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "csxq0605.github.io visitor-atlas",
        })
        for attempt in range(3):
            try:
                with opener(request, timeout=30) as response:
                    payload = json.load(response)
                break
            except urllib.error.HTTPError as error:
                if error.code == 429 and attempt < 2:  # rate limited
                    sleep(int(error.headers.get("X-Rate-Limit-Reset", "10") or 10) + 1)
                    continue
                raise
        stats = payload.get("stats")
        if not isinstance(stats, list):
            raise ValueError("unexpected API response: no stats list")
        rows.extend(stats)
        if not payload.get("more"):
            return rows
    raise ValueError("too many pages of location stats")


def build_atlas(rows, centroids, start, now):
    regions, unlocated = {}, 0
    for row in rows:
        code = str(row.get("id") or "").upper()
        count = row.get("count")
        if not isinstance(count, int) or count < 0:
            raise ValueError("invalid count in API response")
        place = centroids.get(code)
        if place is None:
            unlocated += count
            continue
        if code in regions:
            regions[code]["visits"] += count
        else:
            regions[code] = {"code": code, "name": place["name"], "lat": place["lat"], "lng": place["lng"], "visits": count}
    ordered = sorted(regions.values(), key=lambda r: (-r["visits"], r["name"]))
    return {
        "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period_start": start or None,
        "unlocated_visits": unlocated,
        "regions": ordered,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--config", default=ROOT / "_data" / "analytics.json")
    parser.add_argument("--output", required=True)
    parser.add_argument("--api-base", help="override https://<site>.goatcounter.com (tests)")
    args = parser.parse_args(argv)

    site, start = load_config(args.config)
    if not site:
        print("Visitor counting is off: goatcounter_site is empty in _data/analytics.json.")
        return 0
    token = os.environ.get("GOATCOUNTER_API_TOKEN", "").strip()
    if not token:
        print("GOATCOUNTER_API_TOKEN is not set; add it as an Actions secret.", file=sys.stderr)
        return 1
    now = datetime.now(timezone.utc)
    base = args.api_base or "https://{}.goatcounter.com".format(site)
    try:
        rows = fetch_locations(base, token, start, now.strftime("%Y-%m-%dT%H:00:00Z"))
        atlas = build_atlas(rows, json.loads(CENTROIDS.read_text()), start, now)
    except (urllib.error.URLError, ValueError, OSError) as error:
        print("Export failed, keeping the previous file: {}".format(error), file=sys.stderr)
        return 1
    Path(args.output).write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + "\n")
    total = sum(r["visits"] for r in atlas["regions"]) + atlas["unlocated_visits"]
    print("Wrote {} countries, {} visitors.".format(len(atlas["regions"]), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
