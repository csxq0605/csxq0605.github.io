#!/usr/bin/env python3
"""Copy each project's README (and the images it uses) into the site.

For every entry in _data/projects.yml that has `repo` and `slug`, this clones
the repository (shallow), rewrites the README so it renders correctly inside
Jekyll, and writes:

    _projects/<slug>.md                 the README, shown at /projects/<slug>/
    assets/projects/<slug>/...          images the README references

Images are self-hosted so the README panel works where GitHub is slow or
blocked. Badges (shields.io) are dropped; links to other repository files
point back to GitHub.

Usage: python3 scripts/sync_project_readmes.py [--only SLUG] [--source-dir DIR]
  --source-dir: use existing checkouts at DIR/<repo-name> instead of cloning.
"""
import argparse
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
MAX_IMAGE_BYTES = 1_500_000


def load_projects():
    """Tiny reader for the flat list in _data/projects.yml (avoids a PyYAML dependency)."""
    projects, current = [], None
    for line in (ROOT / "_data" / "projects.yml").read_text().splitlines():
        if line.startswith("- "):
            current = {}
            projects.append(current)
            line = "  " + line[2:]
        m = re.match(r"^  (\w+):\s*(.*)$", line)
        if current is not None and m and not m.group(2).startswith(("|", ">", "[")):
            current[m.group(1)] = m.group(2).strip().strip('"')
    return [p for p in projects if p.get("repo") and p.get("slug")]


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def resolve(base_dir, target):
    """Repository-relative path for a link target, or None if it leaves the repo."""
    path = posixpath.normpath(posixpath.join(base_dir, target.split("#")[0].split("?")[0]))
    return None if path.startswith("..") else path


def rewrite(readme, checkout, repo, branch, slug, assets_dir):
    blob = "https://github.com/{}/blob/{}/".format(repo, branch)
    copied = []

    def image(target):
        if re.match(r"^[a-z]+://|^//|^data:", target):
            return target
        path = resolve("", target)
        source = checkout / path if path else None
        if not source or not source.is_file() or source.suffix.lower() not in IMAGE_EXT or source.stat().st_size > MAX_IMAGE_BYTES:
            return blob + (path or target)
        dest = assets_dir / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
        copied.append(path)
        return "/assets/projects/{}/{}".format(slug, path)

    def link(target):
        if re.match(r"^[a-z]+:|^//|^#", target):
            return target
        path = resolve("", target)
        return blob + path if path else target

    text = readme
    # Drop shields.io badge lines and HTML comments.
    text = re.sub(r"^\s*\[?!\[[^\]]*\]\(https://img\.shields\.io[^\n]*\n", "", text, flags=re.M)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    # Drop language-switcher lines such as "**English** | [简体中文](README.zh-CN.md)".
    text = re.sub(r"^[^\n|]*(English|中文)[^\n]*\|[^\n]*(English|中文)[^\n]*\n", "", text, flags=re.M)
    # Markdown images, then links.
    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)", lambda m: "![{}]({}{})".format(m.group(1), image(m.group(2)), m.group(3)), text)
    text = re.sub(r"(?<!!)\[([^\]]*)\]\(([^)\s]+)([^)]*)\)", lambda m: "[{}]({}{})".format(m.group(1), link(m.group(2)), m.group(3)), text)
    # HTML images and links.
    text = re.sub(r'(<img[^>]*\ssrc=")([^"]+)"', lambda m: m.group(1) + image(m.group(2)) + '"', text)
    text = re.sub(r'(<a[^>]*\shref=")([^"]+)"', lambda m: m.group(1) + link(m.group(2)) + '"', text)
    # Let kramdown parse markdown inside GitHub's centered header blocks.
    text = re.sub(r'<(div|p)\s+align="center"\s*>', r'<\1 class="readme-center" markdown="1">', text)
    # Remove a leading H1 that repeats the project name; the panel has its own title.
    text = re.sub(r"\A\s*#\s+[^\n]+\n", "", text)
    return text.strip() + "\n", copied


def sync(project, source_dir=None):
    slug, repo = project["slug"], project["repo"]
    with tempfile.TemporaryDirectory() as tmp:
        if source_dir:
            checkout = Path(source_dir) / repo.split("/")[1]
        else:
            checkout = Path(tmp) / "repo"
            git("clone", "-q", "--depth", "1", "https://github.com/{}.git".format(repo), str(checkout))
        branch = git("rev-parse", "--abbrev-ref", "HEAD", cwd=checkout)
        commit = git("rev-parse", "--short", "HEAD", cwd=checkout)
        readme_path = next((p for p in sorted(checkout.iterdir()) if p.name.lower() == "readme.md"), None)
        if readme_path is None:
            raise FileNotFoundError("{} has no README.md".format(repo))
        assets_dir = ROOT / "assets" / "projects" / slug
        if assets_dir.exists():
            shutil.rmtree(assets_dir)
        body, copied = rewrite(readme_path.read_text(encoding="utf-8"), checkout, repo, branch, slug, assets_dir)
    if "{% endraw %}" in body:
        raise ValueError("README contains a Liquid raw terminator")
    front = (
        "---\n"
        "# Generated by scripts/sync_project_readmes.py — edit the README in {repo} instead.\n"
        "slug: {slug}\n"
        "title: \"{name}\"\n"
        "repo: {repo}\n"
        "source_commit: {commit}\n"
        "synced_at: {date}\n"
        "excerpt_separator: \"<!-- no excerpt -->\"\n"
        "---\n"
    ).format(repo=repo, slug=slug, name=project.get("name", slug), commit=commit,
             date=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    out = ROOT / "_projects" / "{}.md".format(slug)
    out.parent.mkdir(exist_ok=True)
    out.write_text(front + "{% raw %}\n" + body + "{% endraw %}\n", encoding="utf-8")
    print("{}: README from {}@{}, {} image(s)".format(slug, repo, commit, len(copied)))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only")
    parser.add_argument("--source-dir")
    args = parser.parse_args(argv)
    projects = [p for p in load_projects() if not args.only or p["slug"] == args.only]
    if not projects:
        print("No matching projects with repo and slug in _data/projects.yml", file=sys.stderr)
        return 1
    for project in projects:
        sync(project, args.source_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
