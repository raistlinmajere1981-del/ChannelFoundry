#!/usr/bin/env python3
"""Read Codex exec --json JSONL; never guess usage from log byte size.

The CLI's turn.completed.usage is the only authoritative token count here.
An in-process spawned-agent breakdown is not guaranteed by this stream.
"""
from __future__ import annotations

import json
from pathlib import Path

TOKEN_KEYS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens")


def parse_events(path: Path) -> dict:
    records = []
    errors = []
    agent_events = []
    malformed = 0
    seen_types: dict[str, int] = {}
    if not path.exists():
        return {"usage": None, "turns": 0, "errors": ["log_missing"], "events": {},
                "agentEvents": 0, "malformedLines": 0}
    with path.open(encoding="utf-8", errors="replace") as stream:
        for line in stream:
            try:
                obj = json.loads(line)
            except ValueError:
                malformed += 1
                continue
            if not isinstance(obj, dict):
                continue
            typ = str(obj.get("type", ""))
            seen_types[typ] = seen_types.get(typ, 0) + 1
            if typ == "turn.completed":
                usage = obj.get("usage")
                if isinstance(usage, dict) and any(isinstance(usage.get(k), int) for k in TOKEN_KEYS):
                    records.append(usage)
            if typ in ("error", "turn.failed"):
                errors.append(str(obj.get("message") or obj.get("error") or typ)[:240])
            if typ.startswith("item.") and isinstance(obj.get("item"), dict):
                item = obj["item"]
                item_type = str(item.get("type") or "")
                if any(word in item_type for word in ("collab", "subagent", "agent_spawn", "agent_tool")):
                    agent_events.append((typ, item_type))
    usage = None
    if records:
        usage = {}
        for key in TOKEN_KEYS:
            values = [r.get(key) for r in records if isinstance(r.get(key), int)]
            usage[key] = sum(values) if values else None
        usage["total_tokens"] = ((usage.get("input_tokens") or 0) +
                                 (usage.get("output_tokens") or 0))
        usage["uncached_input_tokens"] = (max(0, (usage.get("input_tokens") or 0) -
                                               (usage.get("cached_input_tokens") or 0))
                                          if usage.get("input_tokens") is not None else None)
        usage["source"] = "codex_exec_turn_completed"
        usage["note"] = "CLI-reported totals; internal subagents may not have separate breakdowns"
    return {"usage": usage, "turns": len(records), "errors": errors[:8],
            "events": seen_types, "agentEvents": len(agent_events),
            "malformedLines": malformed}


def sum_usages(rows: list[dict]) -> dict:
    """Unknown counters stay unknown; never substitute zero for missing usage."""
    valid = [row["usage"] for row in rows if isinstance(row.get("usage"), dict)]
    aggregate = {}
    for key in TOKEN_KEYS + ("total_tokens", "uncached_input_tokens"):
        values = [r.get(key) for r in valid if isinstance(r.get(key), int)]
        aggregate[key] = sum(values) if len(values) == len(rows) and rows else None
    aggregate["calls"] = len(rows)
    aggregate["measuredCalls"] = len(valid)
    return aggregate


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("log", type=Path)
    args = p.parse_args()
    print(json.dumps(parse_events(args.log), ensure_ascii=False, indent=2))
