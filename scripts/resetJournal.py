#!/usr/bin/env python3
"""RESET journal utilities.

The Parquet file is the durable journal. JSON files are derived views for:
- the small-model novelty context (`data/history.json`)
- the static GitHub Pages journal (`public/generated/journal.json`)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

SCHEMA = pa.schema([
    ("pack_date", pa.string()),
    ("scene_id", pa.string()),
    ("slot", pa.int16()),
    ("generated_at", pa.string()),
    ("scene", pa.string()),
    ("scene_time", pa.string()),
    ("scene_time_minutes", pa.int16()),
    ("scene_time_band", pa.string()),
    ("voice", pa.string()),
    ("model", pa.string()),
    ("world_capsule_id", pa.string()),
    ("creative_pressure_json", pa.string()),
    ("time_envelope", pa.string()),
    ("trigger", pa.string()),
    ("github_run_id", pa.string()),
])


def load_rows(path: Path) -> list[dict]:
    if not path.exists() or path.stat().st_size == 0:
        return []
    table = pq.read_table(path)
    rows = table.to_pylist()
    return [normalize_row(row) for row in rows]


def normalize_row(row: dict) -> dict:
    out = {field.name: row.get(field.name) for field in SCHEMA}
    out["slot"] = int(out.get("slot") or 0)
    out["scene_time_minutes"] = int(out.get("scene_time_minutes") or 0)
    for key in (
        "pack_date", "scene_id", "generated_at", "scene", "scene_time",
        "scene_time_band", "voice", "model", "world_capsule_id",
        "creative_pressure_json", "time_envelope", "trigger", "github_run_id",
    ):
        out[key] = "" if out.get(key) is None else str(out[key])
    return out


def write_rows(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [normalize_row(row) for row in rows]
    rows.sort(key=lambda r: (r["pack_date"], r["slot"], r["scene_id"]))
    table = pa.Table.from_pylist(rows, schema=SCHEMA)
    pq.write_table(table, path, compression="zstd")


def manifest_rows(manifest: dict, trigger: str, run_id: str) -> list[dict]:
    date = str(manifest.get("date") or "")
    generated_at = str(manifest.get("generatedAt") or datetime.now(timezone.utc).isoformat())
    model = str(manifest.get("model") or "gemma3:4b")
    rows = []
    for index, item in enumerate(manifest.get("scenes") or [], start=1):
        rows.append({
            "pack_date": date,
            "scene_id": str(item.get("id") or f"{date}-{index:03d}"),
            "slot": index,
            "generated_at": generated_at,
            "scene": str(item.get("scene") or ""),
            "scene_time": str(item.get("sceneTime") or ""),
            "scene_time_minutes": int(item.get("sceneTimeMinutes") or 0),
            "scene_time_band": str(item.get("sceneTimeBand") or ""),
            "voice": str(item.get("voice") or ""),
            "model": model,
            "world_capsule_id": str(item.get("worldCapsuleId") or ""),
            "creative_pressure_json": json.dumps(item.get("creativePressure") or [], ensure_ascii=False, separators=(",", ":")),
            "time_envelope": str(item.get("timeEnvelope") or ""),
            "trigger": trigger,
            "github_run_id": run_id,
        })
    return rows


def append_manifest(args: argparse.Namespace) -> int:
    parquet_path = Path(args.parquet)
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    incoming = manifest_rows(manifest, args.trigger, args.run_id)
    if len(incoming) != args.expected_count:
        raise SystemExit(f"Expected {args.expected_count} scenes, manifest has {len(incoming)}")

    current = load_rows(parquet_path)
    date = str(manifest.get("date") or "")
    # One canonical daily set: re-runs replace that date rather than inflating the journal.
    retained = [row for row in current if row["pack_date"] != date]
    write_rows(parquet_path, [*retained, *incoming])
    print(f"Journal now contains {len(retained) + len(incoming)} RESET rows across {len(set(r['pack_date'] for r in [*retained, *incoming]))} days")
    return 0


def check_date(args: argparse.Namespace) -> int:
    rows = load_rows(Path(args.parquet))
    count = sum(1 for row in rows if row["pack_date"] == args.date)
    should_render = args.force or count < args.expected_count
    print(f"date={args.date} existing={count} expected={args.expected_count} force={str(args.force).lower()} should_render={str(should_render).lower()}")
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as fh:
            fh.write(f"date={args.date}\n")
            fh.write(f"existing={count}\n")
            fh.write(f"should_render={'true' if should_render else 'false'}\n")
    return 0


def export_views(args: argparse.Namespace) -> int:
    rows = load_rows(Path(args.parquet))
    rows.sort(key=lambda r: (r["pack_date"], r["slot"]))

    history_rows = rows
    if args.history_days > 0 and rows:
        try:
            newest = max(datetime.strptime(r["pack_date"], "%Y-%m-%d") for r in rows)
            cutoff = newest - timedelta(days=args.history_days - 1)
            history_rows = [r for r in rows if datetime.strptime(r["pack_date"], "%Y-%m-%d") >= cutoff]
        except ValueError:
            history_rows = rows[-args.history_days * 3:]

    days: dict[str, list[dict]] = {}
    for row in history_rows:
        days.setdefault(row["pack_date"], []).append(to_history_scene(row))
    history = {
        "version": 2,
        "source": "data/reset_journal.parquet",
        "days": [
            {"date": date, "scenes": scenes}
            for date, scenes in sorted(days.items())
        ],
    }
    history_path = Path(args.history_json)
    history_path.parent.mkdir(parents=True, exist_ok=True)
    history_path.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    journal = {
        "version": 1,
        "source": "reset_journal.parquet",
        "count": len(rows),
        "days": [],
    }
    all_days: dict[str, list[dict]] = {}
    for row in rows:
        all_days.setdefault(row["pack_date"], []).append(to_public_scene(row))
    for date in sorted(all_days.keys(), reverse=True):
        journal["days"].append({"date": date, "scenes": all_days[date]})

    public_path = Path(args.public_json)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.write_text(json.dumps(journal, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Exported {len(history_rows)} novelty rows and {len(rows)} journal rows")
    return 0


def to_history_scene(row: dict) -> dict:
    return {
        "id": row["scene_id"],
        "scene": row["scene"],
        "sceneTime": row["scene_time"],
        "sceneTimeMinutes": row["scene_time_minutes"],
        "sceneTimeBand": row["scene_time_band"],
        "voice": row["voice"],
        "worldCapsuleId": row["world_capsule_id"],
        "creativePressure": json.loads(row["creative_pressure_json"] or "[]"),
        "timeEnvelope": row["time_envelope"],
    }


def to_public_scene(row: dict) -> dict:
    return {
        "id": row["scene_id"],
        "scene": row["scene"],
        "sceneTime": row["scene_time"],
        "sceneTimeMinutes": row["scene_time_minutes"],
        "sceneTimeBand": row["scene_time_band"],
        "voice": row["voice"],
        "model": row["model"],
        "worldCapsuleId": row["world_capsule_id"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check-date")
    p.add_argument("--parquet", default="data/reset_journal.parquet")
    p.add_argument("--date", required=True)
    p.add_argument("--expected-count", type=int, default=3)
    p.add_argument("--force", action="store_true")
    p.add_argument("--github-output", default=os.environ.get("GITHUB_OUTPUT", ""))
    p.set_defaults(func=check_date)

    p = sub.add_parser("append-manifest")
    p.add_argument("--parquet", default="data/reset_journal.parquet")
    p.add_argument("--manifest", required=True)
    p.add_argument("--expected-count", type=int, default=3)
    p.add_argument("--trigger", default=os.environ.get("GITHUB_EVENT_NAME", "manual"))
    p.add_argument("--run-id", default=os.environ.get("GITHUB_RUN_ID", "local"))
    p.set_defaults(func=append_manifest)

    p = sub.add_parser("export-views")
    p.add_argument("--parquet", default="data/reset_journal.parquet")
    p.add_argument("--history-json", default="data/history.json")
    p.add_argument("--public-json", default="public/generated/journal.json")
    p.add_argument("--history-days", type=int, default=60)
    p.set_defaults(func=export_views)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
