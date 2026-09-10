import json
from datetime import datetime

with open('data_old.json', 'r', encoding='utf-8') as f:
    old_data = json.load(f)

with open('data_v3.json', 'r', encoding='utf-8') as f:
    v3_data = json.load(f)

# Unique keywords to identify institutions across different naming conventions
KEYWORDS = [
    "sucofindo", "qualis", "tuv rheinland", "bbspjibbt", "bspji surabaya", 
    "bspji jakarta", "panasonic", "hartono", "star cosmos", "vertex", 
    "multicert", "integrita", "anindya", "solusi sertifikasi", "rajawali", 
    "brin", "lke", "bbspkebtke", "bpmb", "prolab", "ul internasional",
    "bahan dan barang teknik", "jasa industri surabaya", "jasa industri jakarta",
    "konversi energi", "survei dan pengujian ketenagalistrikan", "pengujian mutu barang"
]

def get_identifier(name):
    name_lower = name.lower()
    for kw in KEYWORDS:
        if kw in name_lower:
            # Map alternative names to primary keyword for matching
            if kw == "bahan dan barang teknik": return "bbspjibbt"
            if kw == "jasa industri surabaya": return "bspji surabaya"
            if kw == "jasa industri jakarta": return "bspji jakarta"
            if kw == "konversi energi" or kw == "lke": return "brin"
            if kw == "survei dan pengujian ketenagalistrikan": return "bbspkebtke"
            if kw == "pengujian mutu barang": return "bpmb"
            return kw
    # Fallback to normalized name if no keyword matches
    import re
    return re.sub(r'[^a-z0-9]', '', name_lower.replace('pt ', ''))

def smart_merge(section):
    old_list = old_data[section]
    v3_list = v3_data[section]
    
    merged = []
    processed_v3_ids = set()
    
    # 1. Start with old list, update if found in V3
    for old_entry in old_list:
        kat = old_entry['kategori']
        old_id = get_identifier(old_entry['nama'])
        
        # Look for this in V3
        matching_v3 = None
        for v3_entry in v3_list:
            if v3_entry['kategori'] == kat and get_identifier(v3_entry['nama']) == old_id:
                matching_v3 = v3_entry
                processed_v3_ids.add(f"{kat}_{old_id}")
                break
                
        if matching_v3:
            # UPDATE old entry with new dates, status, and name
            old_entry['nama'] = matching_v3['nama'] # Use newer clean name
            old_entry['alamat'] = matching_v3['alamat']
            old_entry['mulai_berlaku'] = matching_v3['mulai_berlaku']
            old_entry['jangka_waktu'] = matching_v3['jangka_waktu']
            old_entry['keterangan'] = matching_v3['keterangan']
        else:
            # Keep as is (expired/not in V3)
            pass
            
        merged.append(old_entry)
        
    # 2. Add brand new entries from V3
    for v3_entry in v3_list:
        kat = v3_entry['kategori']
        v3_id = get_identifier(v3_entry['nama'])
        if f"{kat}_{v3_id}" not in processed_v3_ids:
            merged.append(v3_entry)
            
    # Fix numbering
    final_merged = []
    categories = sorted(list(set(e['kategori'] for e in merged)))
    for kat in categories:
        kat_entries = [e for e in merged if e['kategori'] == kat]
        for idx, entry in enumerate(kat_entries, 1):
            entry['no'] = f"{idx}."
            final_merged.append(entry)
            
    return final_merged

final_data = {
    "lspro": smart_merge('lspro'),
    "lab_uji": smart_merge('lab_uji'),
    "generated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
}

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(final_data, f, ensure_ascii=False, indent=2)

print(f"Merge completed! LSPro: {len(final_data['lspro'])}, Lab Uji: {len(final_data['lab_uji'])}")
