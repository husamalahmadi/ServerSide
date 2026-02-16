"""
Fetch S&P 500 financial data with retry loop: regenerate JSON, detect missing companies,
re-fetch missing from Twelve Data API until ALL companies have complete data.

Usage: python fetch_sp500_complete.py [--fresh]
  --fresh  Ignore existing output and regenerate from scratch
"""

import json
import time
import sys
from pathlib import Path

import requests

API_KEY = "5da413057f75498490b0303582e0d0de"
BASE_URL = "https://api.twelvedata.com"
SP500_JSON_PATH = "public/data/sp500_grouped_by_industry.json"
OUTPUT_PATH = "public/data/sp500_all_financial_data.json"
DELAY_SECONDS = 1.5
MAX_RETRIES_PER_COMPANY = 3  # Stop retrying after this many attempts per company


def load_sp500_companies(path: str) -> list[dict]:
    """Load S&P 500 companies from JSON, preserving order."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    companies = []
    for industry, items in data.items():
        for item in items:
            ticker = str(item["Ticker"]).strip().upper()
            companies.append({
                "ticker": ticker,
                "company": item["Company"],
                "industry": industry,
                "symbol": ticker,  # US stocks use ticker as symbol (e.g. AAPL)
            })
    return companies


def fetch_endpoint(endpoint_name: str, symbol: str, retries: int = 2) -> dict:
    """Fetch from Twelve Data API. Retries on failure."""
    url = f"{BASE_URL}/{endpoint_name}"
    params = {"symbol": symbol, "apikey": API_KEY}
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get("code") and data.get("code") >= 400:
                return {"error": data.get("message", "API error")}
            return data
        except Exception as e:
            if attempt < retries:
                time.sleep(DELAY_SECONDS * 2)
            else:
                return {"error": str(e)}


def fetch_company_data(symbol: str) -> dict:
    """Fetch all financial data for one company."""
    result = {
        "enterprise_value": None,
        "market_capitalization": None,
        "forward_pe": None,
        "price_to_sales_ttm": None,
        "outstanding_common_stocks": None,
        "sales": [],
        "gross_profit": [],
        "operating_income": [],
        "net_income": [],
        "equity": [],
        "free_cash_flow": [],
        "short_term_debt": None,
        "long_term_debt": None,
        "cash_and_cash_equivalents": None,
    }

    # 1. Statistics
    stats_data = fetch_endpoint("statistics", symbol)
    time.sleep(DELAY_SECONDS)
    if stats_data and "error" not in stats_data and "statistics" in stats_data:
        stats = stats_data["statistics"]
        if "valuations_metrics" in stats:
            vm = stats["valuations_metrics"]
            result["enterprise_value"] = vm.get("enterprise_value")
            result["market_capitalization"] = vm.get("market_capitalization")
            result["forward_pe"] = vm.get("forward_pe")
            result["price_to_sales_ttm"] = vm.get("price_to_sales_ttm")
        if "stock_statistics" in stats:
            result["outstanding_common_stocks"] = stats["stock_statistics"].get("shares_outstanding")
    elif stats_data and "error" in stats_data:
        result["_error"] = stats_data.get("error", "Unknown error")

    # 2. Income Statement
    inc_data = fetch_endpoint("income_statement", symbol)
    time.sleep(DELAY_SECONDS)
    if inc_data and "error" not in inc_data and "income_statement" in inc_data:
        for item in inc_data["income_statement"]:
            sales_val = item.get("sales") or item.get("revenue") or item.get("total_revenue") or item.get("net_sales")
            result["sales"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": sales_val})
            result["gross_profit"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("gross_profit")})
            result["operating_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("operating_income")})
            result["net_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("net_income")})

    # 3. Balance Sheet
    bal_data = fetch_endpoint("balance_sheet", symbol)
    time.sleep(DELAY_SECONDS)
    if bal_data and "error" not in bal_data and "balance_sheet" in bal_data:
        items = bal_data["balance_sheet"]
        for item in items:
            equity_val = None
            if "shareholders_equity" in item:
                equity_val = item["shareholders_equity"].get("total_shareholders_equity")
            result["equity"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": equity_val})
        if items:
            first = items[0]
            curr_liab = (first.get("liabilities") or {}).get("current_liabilities") or {}
            noncurr_liab = (first.get("liabilities") or {}).get("non_current_liabilities") or {}
            curr_assets = (first.get("assets") or {}).get("current_assets") or {}
            result["short_term_debt"] = curr_liab.get("short_term_debt") if isinstance(curr_liab, dict) else None
            result["long_term_debt"] = noncurr_liab.get("long_term_debt") if isinstance(noncurr_liab, dict) else None
            result["cash_and_cash_equivalents"] = (
                curr_assets.get("cash_and_cash_equivalents") or curr_assets.get("cash")
                if isinstance(curr_assets, dict)
                else None
            )

    # 4. Cash Flow
    cf_data = fetch_endpoint("cash_flow", symbol)
    time.sleep(DELAY_SECONDS)
    if cf_data and "error" not in cf_data and "cash_flow" in cf_data:
        for item in cf_data["cash_flow"]:
            fcf = None
            if "free_cash_flow" in item:
                fcf = item.get("free_cash_flow")
            else:
                op_cf = (item.get("operating_activities") or {}).get("operating_cash_flow") if isinstance(item.get("operating_activities"), dict) else None
                cap_ex = (item.get("investing_activities") or {}).get("capital_expenditures") if isinstance(item.get("investing_activities"), dict) else None
                if op_cf is not None and cap_ex is not None:
                    fcf = op_cf + cap_ex
            result["free_cash_flow"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": fcf})

    return result


def has_full_data(data: dict) -> bool:
    """Check if company has all required financial data."""
    return (
        data.get("enterprise_value") is not None
        and data.get("outstanding_common_stocks") is not None
        and (data.get("sales") or [])
        and (data.get("equity") or [])
    )


def main():
    script_dir = Path(__file__).parent
    sp500_path = script_dir / SP500_JSON_PATH
    out_path = script_dir / OUTPUT_PATH
    fresh = "--fresh" in sys.argv

    if not sp500_path.exists():
        print(f"Error: S&P 500 file not found at {sp500_path}")
        return 1

    companies = load_sp500_companies(str(sp500_path))
    total = len(companies)
    print(f"Loaded {total} S&P 500 companies from {SP500_JSON_PATH}\n")

    # Load existing output if present (unless --fresh)
    out = None
    if not fresh and out_path.exists():
        try:
            with open(out_path, encoding="utf-8") as f:
                out = json.load(f)
            print(f"Loaded existing data from {OUTPUT_PATH}")
        except Exception as e:
            print(f"Could not load existing file: {e}")

    if out is None or "companies" not in out or len(out["companies"]) != total:
        out = {
            "meta": {"source": SP500_JSON_PATH, "total_companies": total, "currency": "USD"},
            "companies": [],
        }
        for c in companies:
            out["companies"].append({
                "ticker": c["ticker"],
                "company": c["company"],
                "industry": c["industry"],
                "symbol": c["symbol"],
                "data": {},
            })
        print("Starting fresh fetch for all companies.")
    else:
        out["meta"]["total_companies"] = total

    round_num = 0
    retry_counts = {c["ticker"]: 0 for c in companies}

    while True:
        round_num += 1
        missing = []
        for i, c in enumerate(out["companies"]):
            if not has_full_data(c.get("data", {})):
                missing.append((i, c))

        if not missing:
            print(f"\nAll {total} companies have complete data.")
            break

        print(f"\n--- Round {round_num}: {len(missing)} companies with missing data ---")

        for idx, (i, c) in enumerate(missing):
            ticker = c["ticker"]
            if retry_counts.get(ticker, 0) >= MAX_RETRIES_PER_COMPANY:
                print(f"  [{idx+1}/{len(missing)}] {ticker} - SKIP (max retries reached)")
                continue
            retry_counts[ticker] = retry_counts.get(ticker, 0) + 1
            print(f"  [{idx+1}/{len(missing)}] {ticker} - refetching...")
            out["companies"][i]["data"] = fetch_company_data(c["symbol"])

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
        print(f"  Saved to {out_path}")

        still_missing = sum(1 for c in out["companies"] if not has_full_data(c.get("data", {})))
        if still_missing == len(missing):
            print(f"\nWarning: {still_missing} companies still missing after retry. Some may not be available in Twelve Data.")
            print("Stopping to avoid infinite loop. Run again to retry.")
            break

    print(f"\nFinal: {sum(1 for c in out['companies'] if has_full_data(c.get('data', {})))}/{total} companies with complete data")
    return 0


if __name__ == "__main__":
    sys.exit(main())
