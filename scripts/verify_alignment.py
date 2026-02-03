import pandas as pd
import sqlite3
import json
import re
import os
from pathlib import Path

# Config
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / 'data/cold-caller.db'
MASTER_JSON = BASE_DIR / 'master_dentists.json'
# Fallback if master_dentists.json not found
CLEAN_JSON = BASE_DIR / 'dentists_clean_import_v2.json'

JSON_FILE = MASTER_JSON if MASTER_JSON.exists() else CLEAN_JSON

def normalize_name(name):
    if not name: return ''
    return re.sub(r'[\s\-\"\'\.\,\(\)]+', '', str(name).upper().strip())

def main():
    print(f"VERIFICATION REPORT")
    print("=" * 60)

    # 1. Get User IDs
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    
    users = {
        'ico': None,
        'dani': None
    }
    
    rows = cur.execute("SELECT id, username, display_name FROM users").fetchall()
    for r in rows:
        uid, uname, dname = r
        uname = uname.lower()
        dname = (dname or '').lower()
        if 'ico' in uname or 'ico' in dname: users['ico'] = uid
        if 'dani' in uname or 'dani' in dname: users['dani'] = uid
        
    print(f"User IDs: Ico={users['ico']}, Dani={users['dani']}")
    if not users['ico'] or not users['dani']:
        print("ERROR: Could not find user IDs for Ico or Dani.")
        return

    # 2. Load Excel Lists
    print("\n[LOADING EXCEL SOURCE LISTS]")
    ico_excel = set()
    dani_excel = set()
    
    for f in BASE_DIR.glob('КЛИЕНТИ ИЦО*.xlsx'):
        print(f"Reading {f.name}...")
        df = pd.read_excel(f)
        for name in df['Фирма'].dropna():
            ico_excel.add(normalize_name(name))
            
    for f in BASE_DIR.glob('КЛИЕНТИ_ДАНИ*.xlsx'):
        print(f"Reading {f.name}...")
        df = pd.read_excel(f)
        for name in df['Фирма'].dropna():
            dani_excel.add(normalize_name(name))
            
    print(f"Excel Counts: Ico={len(ico_excel)}, Dani={len(dani_excel)}")

    # 3. Load Database
    print("\n[LOADING DATABASE]")
    # Get all dentists
    db_map = {} # norm_name -> {id, caller_id}
    rows = cur.execute("SELECT id, facility_name, preferred_caller_id FROM dentists").fetchall()
    
    db_ico_count = 0
    db_dani_count = 0
    
    for r in rows:
        did, name, cid = r
        norm = normalize_name(name)
        db_map[norm] = {'id': did, 'caller_id': cid}
        
        if cid == users['ico']: db_ico_count += 1
        if cid == users['dani']: db_dani_count += 1
        
    print(f"DB Assignments: Ico={db_ico_count}, Dani={db_dani_count}")

    # 4. Load Master JSON
    print("\n[LOADING MASTER JSON]")
    json_map = {}
    if JSON_FILE.exists():
        with open(JSON_FILE, 'r') as f:
            data = json.load(f)
            for item in data:
                name = item.get('name') or item.get('facility_name')
                caller_code = item.get('preferred_caller') # 'ico', 'dani' usually
                norm = normalize_name(name)
                json_map[norm] = caller_code
        print(f"Loaded {len(json_map)} records from {JSON_FILE.name}")
    else:
        print("Master JSON not found!")

    # 5. Verification: Excel vs DB
    print("\n" + "="*30)
    print("COMPARISON: EXCEL -> DATABASE")
    print("="*30)

    # Check Ico
    missing_ico = []
    wrong_caller_ico = []
    
    for name in ico_excel:
        if name not in db_map:
            missing_ico.append(name)
        else:
            cid = db_map[name]['caller_id']
            if cid != users['ico']:
                wrong_caller_ico.append((name, cid))
                
    print(f"ICO: Found {len(ico_excel)} in Excel.")
    print(f"  - Missing in DB: {len(missing_ico)}")
    if missing_ico: print(f"    Examples: {missing_ico[:3]}...")
    print(f"  - Wrong Caller in DB: {len(wrong_caller_ico)}")
    if wrong_caller_ico: print(f"    Examples: {wrong_caller_ico[:3]}...")

    # Check Dani
    missing_dani = []
    wrong_caller_dani = []
    
    for name in dani_excel:
        if name not in db_map:
            missing_dani.append(name)
        else:
            cid = db_map[name]['caller_id']
            if cid != users['dani']:
                wrong_caller_dani.append((name, cid))

    print(f"DANI: Found {len(dani_excel)} in Excel.")
    print(f"  - Missing in DB: {len(missing_dani)}")
    if missing_dani: print(f"    Examples: {missing_dani[:3]}...")
    print(f"  - Wrong Caller in DB: {len(wrong_caller_dani)}")
    if wrong_caller_dani: print(f"    Examples: {wrong_caller_dani[:3]}...")

    # 6. Verification: DB -> Excel (Reverse check for extras)
    print("\n" + "="*30)
    print("COMPARISON: DATABASE -> EXCEL (Extras)")
    print("="*30)
    
    extra_ico = []
    for name, data in db_map.items():
        if data['caller_id'] == users['ico']:
            if name not in ico_excel:
                extra_ico.append(name)
                
    print(f"ICO: DB has {db_ico_count} assigned.")
    print(f"  - Extra (Not in Excel): {len(extra_ico)}")
    if extra_ico: print(f"    Examples: {extra_ico[:3]}...")

    extra_dani = []
    for name, data in db_map.items():
        if data['caller_id'] == users['dani']:
            if name not in dani_excel:
                extra_dani.append(name)

    print(f"DANI: DB has {db_dani_count} assigned.")
    print(f"  - Extra (Not in Excel): {len(extra_dani)}")
    if extra_dani: print(f"    Examples: {extra_dani[:3]}...")

    # 7. Verification: DB vs JSON
    print("\n" + "="*30)
    print("COMPARISON: DATABASE <-> MASTER JSON")
    print("="*30)
    
    json_mismatch = 0
    for name, data in db_map.items():
        if name in json_map:
            json_caller = json_map[name]
            db_caller_id = data['caller_id']
            
            # Map code to ID
            expected_id = None
            if json_caller == 'ico': expected_id = users['ico']
            elif json_caller == 'dani': expected_id = users['dani']
            
            if db_caller_id != expected_id:
                # Allow None == None
                if not db_caller_id and not expected_id: continue
                # print(f"Mismatch {name}: DB={db_caller_id} JSON={json_caller}")
                json_mismatch += 1
                
    print(f"JSON vs DB Caller Mismatches: {json_mismatch}")

    con.close()

if __name__ == "__main__":
    main()
