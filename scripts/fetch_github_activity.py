#!/usr/bin/env python3
"""Save the last year of public GitHub contributions for the activity widget.

Writes _data/github_activity.json: {"user", "total", "start", "end", "updated",
"days": {"YYYY-MM-DD": count}} with zero days omitted. Uses the public
github-contributions-api.jogruber.de service (no token), so visitors never
call GitHub or a third party themselves.
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://github-contributions-api.jogruber.de/v4/{}?y=last"


def main(user):
    request = urllib.request.Request(API.format(user), headers={"User-Agent": "csxq0605.github.io activity widget"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)
    days = data["contributions"]
    if not days:
        raise ValueError("no contribution days returned")
    out = {
        "user": user,
        "total": sum(d["count"] for d in days),
        "start": days[0]["date"],
        "end": days[-1]["date"],
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "days": {d["date"]: d["count"] for d in days if d["count"] > 0},
    }
    (ROOT / "_data" / "github_activity.json").write_text(json.dumps(out, indent=1) + "\n")
    print("{}: {} contributions, {} active days".format(user, out["total"], len(out["days"])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "csxq0605"))
