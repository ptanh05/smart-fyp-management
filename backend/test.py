import requests
import pandas as pd

BASE_URL = "https://www.adgpg.gov.ae/SCAPI/ADGEs/AlMaqtaa"
SESSION_ID = "b395bbf2-1ce6-4670-b75b-b315156d70ad"  # replace with fresh session id

# Common headers
headers = {
    "user-agent": "Mozilla/5.0",
    "x-requested-with": "XMLHttpRequest",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
}

# Minimal cookies needed
cookies = {
    "ASP.NET_SessionId": SESSION_ID,
}

def fetch_tenders(limit=100):
    """Fetch all tenders in batches of 'limit'"""
    all_tenders = []
    offset = 0

    while True:
        data = {
            "status": "OPEN",
            "offset": str(offset),
            "limit": str(limit),
        }

        resp = requests.post(
            f"{BASE_URL}/Tender/List",
            headers=headers,
            cookies=cookies,
            data=data
        )
        resp.raise_for_status()
        result = resp.json()

        tenders = result.get("TenderList", [])
        if not tenders:
            break

        all_tenders.extend(tenders)
        offset += limit

        total = result.get("TenderCount", len(all_tenders))
        if len(all_tenders) >= total:
            break

    return all_tenders


def fetch_tender_details(tender_id):
    """Fetch detailed info for one tender"""
    url = f"{BASE_URL}/Tender/Details/{tender_id}"
    resp = requests.get(url, headers=headers, cookies=cookies)
    resp.raise_for_status()
    return resp.json().get("TenderDetails", {})


def main():
    print("Fetching tenders list...")
    tenders = fetch_tenders(limit=100)
    print(f"Found {len(tenders)} tenders")

    all_data = []
    for i, tender in enumerate(tenders, start=1):
        tid = tender["TenderID"]
        print(f"[{i}/{len(tenders)}] Fetching details for TenderID {tid}...")
        details = fetch_tender_details(tid)
        details.pop("RecommendedTenders", None)  # remove large unnecessary field

        combined = {**tender, **details}  # merge list + detail fields
        all_data.append(combined)

    # Export to Excel
    df = pd.DataFrame(all_data)
    df.to_excel("tenders.xlsx", index=False)
    print("✅ Exported to tenders.xlsx")


if __name__ == "__main__":
    main()
