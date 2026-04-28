"""
Refetch EGX financial data with aggressive symbol fallback.

Why:
- Current egx_financial_data.json may contain mostly empty/zero records.
- Twelve Data often responds differently depending on symbol format.

This script retries each EGX company using multiple symbol candidates:
1) bare ticker (EGS....)
2) ticker:EGX
3) ticker.EGP
4) FIGI (if available)

Usage:
  python scripts/refetch-egx-data.py

Required env:
  TWELVEDATA_API_KEY  (or VITE_TWELVEDATA_API_KEY)
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_URL = "https://api.twelvedata.com"
INPUT_PATH = Path("public/data/egx_grouped_by_sector.json")
OUTPUT_PATH = Path("public/data/egx_financial_data.json")
DELAY_SECONDS = 0.8
REQUEST_TIMEOUT = 35


def get_api_key() -> str:
    key = (os.getenv("TWELVEDATA_API_KEY") or os.getenv("VITE_TWELVEDATA_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("Missing TWELVEDATA_API_KEY (or VITE_TWELVEDATA_API_KEY).")
    return key


def to_candidates(symbol: str, figi: str | None) -> list[str]:
    base = (symbol or "").strip().upper().replace(".EGP", "")
    out = [base, f"{base}:EGX", f"{base}.EGP"]
    if figi:
        out.append(str(figi).strip().upper())
    dedup = []
    for v in out:
        if v and v not in dedup:
            dedup.append(v)
    return dedup


def fetch_endpoint(endpoint: str, symbol: str, api_key: str) -> dict:
    url = f"{BASE_URL}/{endpoint}"
    params = {"symbol": symbol, "apikey": api_key}
    r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    payload = r.json()
    code = payload.get("code")
    if isinstance(code, int) and code >= 400:
        raise RuntimeError(payload.get("message") or f"{endpoint} failed")
    return payload


def has_financial_rows(payload: dict, endpoint: str) -> bool:
    if endpoint == "statistics":
        st = payload.get("statistics") or {}
        vm = st.get("valuations_metrics") or {}
        ss = st.get("stock_statistics") or {}
        fin = st.get("financials") or {}
        return any(
            x not in (None, 0)
            for x in [
                vm.get("enterprise_value"),
                vm.get("market_capitalization"),
                vm.get("price_to_sales_ttm"),
                vm.get("forward_pe"),
                ss.get("shares_outstanding"),
                (fin.get("income_statement") or {}).get("revenue_ttm"),
            ]
        )
    arr = payload.get(endpoint) or []
    return isinstance(arr, list) and len(arr) > 0


def fetch_company(symbol: str, figi: str | None, api_key: str) -> tuple[dict, str]:
    candidates = to_candidates(symbol, figi)
    endpoints = ["statistics", "balance_sheet", "income_statement", "cash_flow"]
    data = {}
    used_symbol = candidates[0] if candidates else symbol

    for ep in endpoints:
        chosen = None
        chosen_payload = None
        for c in candidates:
            try:
                payload = fetch_endpoint(ep, c, api_key)
                if chosen_payload is None:
                    chosen_payload = payload
                    chosen = c
                if has_financial_rows(payload, ep):
                    chosen_payload = payload
                    chosen = c
                    break
            except Exception:
                continue
            finally:
                time.sleep(DELAY_SECONDS)
        data[ep] = chosen_payload or {"meta": {"symbol": symbol}, ep: []}
        if chosen:
            used_symbol = chosen
    return data, used_symbol


def main() -> int:
    api_key = get_api_key()
    if not INPUT_PATH.exists():
        raise RuntimeError(f"Missing input file: {INPUT_PATH}")

    with INPUT_PATH.open("r", encoding="utf-8") as f:
        grouped = json.load(f)

    sectors_out = {}
    total = 0
    failed = 0
    started_at = datetime.now(timezone.utc).isoformat()

    for sector, items in grouped.items():
        companies = {}
        for item in items or []:
            total += 1
            raw_symbol = str(item.get("Symbol") or item.get("Ticker") or "").strip()
            company_name = str(item.get("Company") or "").strip()
            figi = str(item.get("FIGI") or "").strip() or None
            if not raw_symbol:
                failed += 1
                continue
            try:
                data, used_symbol = fetch_company(raw_symbol, figi, api_key)
                companies[raw_symbol] = {
                    "company_name": company_name,
                    "symbol": raw_symbol,
                    "figi": figi,
                    "currency": "EGP",
                    "sector": sector,
                    "used_symbol": used_symbol,
                    "data": data,
                    "fetch_status": "success",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                failed += 1
                companies[raw_symbol] = {
                    "company_name": company_name,
                    "symbol": raw_symbol,
                    "figi": figi,
                    "currency": "EGP",
                    "sector": sector,
                    "data": {},
                    "fetch_status": "failed",
                    "error": str(e),
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
        sectors_out[sector] = {"companies": companies}

    out = {
        "meta": {
            "description": "EGX financial data refetched with multi-symbol fallback",
            "api_key": "REDACTED",
            "input_file": str(INPUT_PATH).replace("\\", "/"),
            "started_at": started_at,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_companies": total,
            "fetched_count": total - failed,
            "failed_count": failed,
        },
        "sectors": sectors_out,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"Saved {OUTPUT_PATH} | total={total} fetched={total-failed} failed={failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
