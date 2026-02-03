import sqlite3
import json
import shutil
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / 'data/cold-caller.db'
MASTER_JSON = BASE_DIR / 'master_dentists.json'
BACKUP_JSON = BASE_DIR / 'master_dentists_backup.json'

def main():
    print(f"Syncing DB -> Master JSON")

    # 1. Backup
    if MASTER_JSON.exists():
        shutil.copy(MASTER_JSON, BACKUP_JSON)
        print(f"Backed up master to {BACKUP_JSON.name}")

    # 2. Connect DB
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # 3. Get Callers Map
    users = cur.execute("SELECT id, username, display_name FROM users").fetchall()
    caller_map = {} # id -> code ('ico', 'dani')
    
    for u in users:
        uid = u['id']
        uname = u['username'].lower()
        dname = (u['display_name'] or '').lower()
        
        # Simple heuristic mapping back to master codes
        if 'ico' in uname or 'ico' in dname:
            caller_map[uid] = 'ico'
        elif 'dani' in uname or 'dani' in dname:
            caller_map[uid] = 'dani'
        else:
            # Fallback for others? Master JSON usually only has these two codes or null.
            caller_map[uid] = uname # Use username if unknown

    # 4. Get Dentists
    rows = cur.execute("SELECT * FROM dentists").fetchall()
    print(f"Reading {len(rows)} records from DB...")

    output_list = []
    
    for row in rows:
        # Construct JSON object matching master schema
        
        # Parse JSON fields
        try:
            locations = json.loads(row['locations']) if row['locations'] else []
        except: locations = []
            
        try:
            # Note: DB column is 'cities_served', JSON uses 'cities' usually?
            # Let's check the header of master_dentists earlier: it had "cities".
            cities = json.loads(row['cities_served']) if row['cities_served'] else []
        except: cities = []
            
        try:
            phones = json.loads(row['phones']) if row['phones'] else []
        except: phones = []
            
        try:
            # 'staff' column in DB, 'dentists' in JSON
            staff = json.loads(row['staff']) if row['staff'] else []
        except: staff = []
            
        try:
            # 'services' in DB -> 'contract_packages' in JSON
            packages = json.loads(row['services']) if row['services'] else []
        except: packages = []

        preferred_code = None
        if row['preferred_caller_id']:
            preferred_code = caller_map.get(row['preferred_caller_id'])

        record = {
            "name": row['facility_name'],
            "region": row['region'], # or region_filter? master had "region" in head
            "manager": row['manager'],
            "phones": phones,
            "locations": locations,
            "cities": cities,
            "dentists": staff,
            "contract_packages": packages,
            "preferred_caller": preferred_code,
            "wants_implants": bool(row['wants_implants']),
            "eik": row['eik'],
            "created_at": row['created_at']
        }
        
        # Clean nulls/empty keys if we want to be strict? 
        # But keeping structure is probably safer.
        
        output_list.append(record)

    # 5. Write
    print(f"Writing {len(output_list)} records to {MASTER_JSON.name}...")
    with open(MASTER_JSON, 'w', encoding='utf-8') as f:
        json.dump(output_list, f, ensure_ascii=False, indent=2)

    print("Done.")

if __name__ == "__main__":
    main()
