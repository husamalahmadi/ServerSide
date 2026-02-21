"""
Add 100 new stocks to sp500_grouped_by_industry.json.
Uses same format as existing entries: { "Ticker": "XXX", "Company": "Name" }
"""

import json
from pathlib import Path

SP500_GROUPED_PATH = Path(__file__).parent.parent / "public/data/sp500_grouped_by_industry.json"

# 100 companies: ticker, company name, industry (must match JSON keys exactly)
NEW_COMPANIES = [
    ("APP", "AppLovin", "Information Technology"),
    ("ARES", "Ares Management", "Financials"),
    ("XYZ", "Block", "Financials"),
    ("CIEN", "Ciena", "Information Technology"),
    ("CVNA", "Carvana", "Consumer Discretionary"),
    ("FIX", "Comfort Systems USA", "Industrials"),
    ("CRH", "CRH plc", "Materials"),
    ("EME", "Emcor", "Industrials"),
    ("HOOD", "Robinhood Markets", "Financials"),
    ("IBKR", "Interactive Brokers", "Financials"),
    ("SNDK", "Sandisk", "Information Technology"),
    ("Q", "Qnity Electronics", "Information Technology"),
    ("SOLS", "Solstice Advanced Materials", "Materials"),
    ("PSKY", "Paramount Skydance", "Communication Services"),
    ("AA", "Alcoa", "Materials"),
    ("AAON", "AAON", "Industrials"),
    ("ACI", "Albertsons", "Consumer Staples"),
    ("ACM", "AECOM", "Industrials"),
    ("ADC", "Agree Realty", "Real Estate"),
    ("AFG", "American Financial Group", "Financials"),
    ("AGCO", "AGCO", "Industrials"),
    ("AIT", "Applied Industrial Technologies", "Industrials"),
    ("ALK", "Alaska Air Group", "Industrials"),
    ("ALLY", "Ally Financial", "Financials"),
    ("AN", "AutoNation", "Consumer Discretionary"),
    ("ANF", "Abercrombie & Fitch", "Consumer Discretionary"),
    ("ARW", "Arrow Electronics", "Information Technology"),
    ("ASH", "Ashland Global", "Materials"),
    ("ATI", "ATI Inc.", "Industrials"),
    ("BAH", "Booz Allen Hamilton", "Industrials"),
    ("BBWI", "Bath & Body Works", "Consumer Discretionary"),
    ("BC", "Brunswick", "Consumer Discretionary"),
    ("BCO", "Brink's", "Industrials"),
    ("BWA", "BorgWarner", "Consumer Discretionary"),
    ("BWXT", "BWX Technologies", "Industrials"),
    ("BYD", "Boyd Gaming", "Consumer Discretionary"),
    ("CACI", "CACI International", "Industrials"),
    ("CAR", "Avis Budget Group", "Industrials"),
    ("CASY", "Casey's General Stores", "Consumer Staples"),
    ("CAVA", "Cava Group", "Consumer Discretionary"),
    ("CCK", "Crown Holdings", "Materials"),
    ("CELH", "Celsius Holdings", "Consumer Staples"),
    ("CG", "Carlyle Group", "Financials"),
    ("CHH", "Choice Hotels", "Consumer Discretionary"),
    ("CHWY", "Chewy", "Consumer Discretionary"),
    ("CLF", "Cleveland-Cliffs", "Materials"),
    ("CMC", "Commercial Metals", "Materials"),
    ("CNH", "CNH Industrial", "Industrials"),
    ("CNO", "CNO Financial Group", "Financials"),
    ("CR", "Crane", "Industrials"),
    ("CROX", "Crocs", "Consumer Discretionary"),
    ("CSL", "Carlisle Companies", "Industrials"),
    ("CUBE", "CubeSmart", "Real Estate"),
    ("CW", "Curtiss-Wright", "Industrials"),
    ("DCI", "Donaldson Company", "Industrials"),
    ("DINO", "HF Sinclair", "Energy"),
    ("DKS", "Dick's Sporting Goods", "Consumer Discretionary"),
    ("DOCU", "Docusign", "Information Technology"),
    ("DT", "Dynatrace", "Information Technology"),
    ("DUOL", "Duolingo", "Consumer Discretionary"),
    ("EHC", "Encompass Health", "Health Care"),
    ("ELF", "e.l.f. Beauty", "Consumer Staples"),
    ("ENTG", "Entegris", "Information Technology"),
    ("EVR", "Evercore", "Financials"),
    ("EXP", "Eagle Materials", "Materials"),
    ("FAF", "First American Financial", "Financials"),
    ("FLEX", "Flex Ltd.", "Information Technology"),
    ("FND", "Floor & Decor", "Consumer Discretionary"),
    ("FTI", "TechnipFMC", "Energy"),
    ("G", "Genpact", "Industrials"),
    ("GAP", "Gap Inc.", "Consumer Discretionary"),
    ("GME", "GameStop", "Consumer Discretionary"),
    ("GMED", "Globus Medical", "Health Care"),
    ("GWRE", "Guidewire Software", "Information Technology"),
    ("GXO", "GXO Logistics", "Industrials"),
    ("H", "Hyatt", "Consumer Discretionary"),
    ("HLNE", "Hamilton Lane", "Financials"),
    ("HOG", "Harley-Davidson", "Consumer Discretionary"),
    ("HRB", "H&R Block", "Consumer Discretionary"),
    ("HXL", "Hexcel", "Industrials"),
    ("ILMN", "Illumina", "Health Care"),
    ("INGR", "Ingredion", "Consumer Staples"),
    ("IPGP", "IPG Photonics", "Information Technology"),
    ("JWN", "Nordstrom", "Consumer Discretionary"),
    ("KEX", "Kirby Corporation", "Industrials"),
    ("LBRT", "Liberty Energy", "Energy"),
    ("MDU", "MDU Resources", "Industrials"),
    ("MUSA", "Murphy USA", "Consumer Staples"),
    ("NBIX", "Neurocrine Biosciences", "Health Care"),
    ("NOV", "NOV Inc.", "Energy"),
    ("OGN", "Organon", "Health Care"),
    ("PEN", "Penumbra", "Health Care"),
    ("PINC", "Premier Inc.", "Health Care"),
    ("POWI", "Power Integrations", "Information Technology"),
    ("RBC", "RBC Bearings", "Industrials"),
    ("RPM", "RPM International", "Materials"),
    ("SAIA", "Saia", "Industrials"),
    ("SIG", "Signet Jewelers", "Consumer Discretionary"),
    ("SNV", "Synovus Financial", "Financials"),
    ("SPB", "Spectrum Brands", "Consumer Staples"),
    ("TDC", "Teradata", "Information Technology"),
    ("TOL", "Toll Brothers", "Consumer Discretionary"),
    ("UAA", "Under Armour", "Consumer Discretionary"),
    ("VSTO", "Vista Outdoor", "Consumer Discretionary"),
    ("WING", "Wingstop", "Consumer Discretionary"),
    ("WSO", "Watsco", "Industrials"),
    ("ZION", "Zions Bancorp", "Financials"),
    ("WDFC", "WD-40 Company", "Materials"),
]


def main():
    with open(SP500_GROUPED_PATH, encoding="utf-8") as f:
        data = json.load(f)

    existing = set()
    for industry, items in data.items():
        for item in items:
            existing.add(str(item["Ticker"]).strip().upper())

    added = 0
    for ticker, company, industry in NEW_COMPANIES:
        ticker_upper = ticker.upper()
        if ticker_upper in existing:
            continue
        if industry not in data:
            data[industry] = []
        data[industry].append({"Ticker": ticker, "Company": company})
        existing.add(ticker_upper)
        added += 1
        if added >= 100:
            break

    with open(SP500_GROUPED_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    total = sum(len(items) for items in data.values())
    print(f"Added {added} companies. Total in sp500_grouped_by_industry.json: {total}")


if __name__ == "__main__":
    main()
