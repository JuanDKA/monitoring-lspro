import json
from datetime import datetime
import re

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Helper to normalize names for deduplication
def normalize_name(name):
    name = name.lower()
    name = re.sub(r'\s+', '', name) # remove all whitespace
    name = re.sub(r'[^a-z0-9]', '', name) # remove all symbols
    name = name.replace('pt', '')
    name = name.replace('persero', '')
    name = name.replace('sbulaboratorium', '')
    
    # Specific hardcoded aliases
    if 'bspjisurabaya' in name or 'bpsjisurabaya' in name or 'jasaindustrisurabaya' in name:
        return 'bspjisurabaya'
    if 'bbspjibbt' in name or 'bahandanbarangteknik' in name:
        return 'bbspjibbt'
    if 'bbspkebtke' in name or 'surveidanpengujianketenagalistrikan' in name:
        return 'bbspkebtke'
    if 'bpmb' in name or 'pengujianmutubarang' in name:
        return 'bpmb'
    if 'lke' in name or 'konversienergi' in name or 'brin' in name:
        return 'brin'
    if 'ulinternasional' in name or 'ulinternational' in name:
        return 'ulinternational'
        
    return name

def dedup_section(section_name):
    entries = data[section_name]
    
    # Group by (kategori, normalized_name)
    grouped = {}
    for entry in entries:
        kat = entry['kategori']
        norm = normalize_name(entry['nama'])
        key = f"{kat}_{norm}"
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(entry)
        
    deduped = []
    
    for key, items in grouped.items():
        if len(items) == 1:
            deduped.append(items[0])
        else:
            # Sort by jangka_waktu (descending) so the newest date comes first
            # If no date, treat as oldest
            def get_date(item):
                try:
                    return datetime.strptime(item.get('jangka_waktu', ''), '%Y-%m-%d')
                except:
                    return datetime.min
                    
            items.sort(key=get_date, reverse=True)
            # Pick the best one (index 0)
            best_item = items[0]
            
            # If the best item has no name, fallback to the one with the longest name
            best_item['nama'] = sorted([i['nama'] for i in items], key=len, reverse=True)[0]
            if not best_item.get('alamat'):
                best_item['alamat'] = sorted([i['alamat'] for i in items if i.get('alamat')], key=len, reverse=True)[0] if [i['alamat'] for i in items if i.get('alamat')] else ''
                
            deduped.append(best_item)
            
    # Fix numbering
    categories = sorted(list(set(e['kategori'] for e in deduped)))
    final_deduped = []
    for kat in categories:
        kat_entries = [e for e in deduped if e['kategori'] == kat]
        # Sort by nama inside category for neatness
        kat_entries.sort(key=lambda x: x['nama'])
        for idx, entry in enumerate(kat_entries, 1):
            entry['no'] = f"{idx}."
            final_deduped.append(entry)
            
    return final_deduped

data['lspro'] = dedup_section('lspro')
data['lab_uji'] = dedup_section('lab_uji')
data['generated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Dedup completed! LSPro: {len(data['lspro'])}, Lab Uji: {len(data['lab_uji'])}")
