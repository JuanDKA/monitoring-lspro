#!/usr/bin/env python3
"""
notifikasi_telegram.py
======================
Dua mode penggunaan:

  1. MODE OTOMATIS (default) — jalankan via Task Scheduler setiap hari:
        python notifikasi_telegram.py
     Hanya kirim notifikasi jika ada lembaga yang HARI INI baru masuk
     ke periode "Segera Berakhir" (sisa tepat 60 hari).
     Jika tidak ada yang baru masuk → TIDAK kirim apapun (silent).

  2. MODE REKAP LENGKAP — jalankan manual kapan saja:
        python notifikasi_telegram.py --rekap
     Kirim semua lembaga yang Segera Berakhir (≤60 hari)
     DAN semua yang Sudah Berakhir (kadaluarsa).

Requirement: pip install requests python-dotenv
"""

import argparse
import json
import os
import sys
from datetime import date, datetime

# ---- Load konfigurasi dari .env ----
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()

try:
    import requests
except ImportError:
    print("ERROR: Module 'requests' belum terinstall.")
    print("Jalankan: pip install requests")
    sys.exit(1)

# ---- Konfigurasi ----
BOT_TOKEN  = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHAT_ID    = os.getenv('TELEGRAM_CHAT_ID', '')
DATA_FILE  = os.path.join(os.path.dirname(__file__), 'data.json')

# Threshold hari untuk "Segera Berakhir"
THRESHOLD_DAYS = 60


# ============================================================
# HELPERS
# ============================================================

def load_data(filepath: str) -> dict:
    if not os.path.exists(filepath):
        print(f"ERROR: File tidak ditemukan: {filepath}")
        sys.exit(1)
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_days_left(jangka_waktu) -> int | None:
    if not jangka_waktu:
        return None
    try:
        end = date.fromisoformat(str(jangka_waktu)[:10])
        return (end - date.today()).days
    except ValueError:
        return None


def format_date(iso_str) -> str:
    if not iso_str:
        return '—'
    try:
        d = date.fromisoformat(str(iso_str)[:10])
        months = ['Jan','Feb','Mar','Apr','Mei','Jun',
                  'Jul','Ags','Sep','Okt','Nov','Des']
        return f"{d.day} {months[d.month-1]} {d.year}"
    except ValueError:
        return str(iso_str)


def today_id() -> str:
    days_id = {
        'Monday':'Senin','Tuesday':'Selasa','Wednesday':'Rabu',
        'Thursday':'Kamis','Friday':'Jumat','Saturday':'Sabtu','Sunday':'Minggu'
    }
    s = datetime.now().strftime('%A, %d %B %Y')
    for en, idn in days_id.items():
        s = s.replace(en, idn)
    return s


def enrich(data: dict) -> list:
    """Gabungkan LSPro + Lab Uji dengan status dan daysLeft."""
    result = []
    for tab_key, tab_label in [('lspro', 'LSPro'), ('lab_uji', 'Lab Uji')]:
        for item in data.get(tab_key, []):
            days_left = get_days_left(item.get('jangka_waktu'))
            if days_left is None:
                status = 'aktif'
            elif days_left < 0:
                status = 'kadaluarsa'
            elif days_left <= THRESHOLD_DAYS:
                status = 'segera'
            else:
                status = 'aktif'
            result.append({**item, 'days_left': days_left, 'status': status, 'tab_label': tab_label})
    return result


# ============================================================
# MODE 1: OTOMATIS — hanya lembaga yang BARU MASUK hari ini
# ============================================================

def get_new_entries(all_items: list) -> list:
    """
    Kembalikan lembaga yang hari ini PERTAMA KALI masuk Segera Berakhir.
    Logika: sisa hari tepat == THRESHOLD_DAYS (hari ini adalah hari ke-60 sebelum berakhir).
    """
    return [d for d in all_items if d['days_left'] == THRESHOLD_DAYS]


def build_message_otomatis(new_entries: list) -> str:
    msg  = f"🔔 *Monitoring LSPro & Lab Uji ESDM*\n"
    msg += f"📅 {today_id()}\n\n"
    msg += f"⚠️ *PERINGATAN — Baru Masuk Segera Berakhir!*\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"Lembaga berikut mulai hari ini masuk periode\n"
    msg += f"*≤{THRESHOLD_DAYS} hari* sebelum masa berlaku berakhir:\n\n"

    for d in new_entries:
        end_str = format_date(d.get('jangka_waktu'))
        msg += f"📌 [{d['tab_label']}] *{d['nama']}*\n"
        msg += f"   📦 {d['kategori']}\n"
        msg += f"   📅 Berakhir: {end_str} ({d['days_left']} hari lagi)\n\n"

    msg += f"_Segera lakukan tindak lanjut perpanjangan._"
    return msg


# ============================================================
# MODE 2: REKAP LENGKAP — semua segera + kadaluarsa
# ============================================================

def build_message_rekap(all_items: list) -> str:
    segera     = sorted([d for d in all_items if d['status'] == 'segera'],
                        key=lambda x: x['days_left'])
    kadaluarsa = sorted([d for d in all_items if d['status'] == 'kadaluarsa'],
                        key=lambda x: x['days_left'])

    msg  = f"🔔 *Monitoring LSPro & Lab Uji ESDM*\n"
    msg += f"📅 {today_id()}\n"
    msg += f"📋 *Rekap Lengkap Status Lembaga*\n\n"

    if not segera and not kadaluarsa:
        msg += "✅ Tidak ada lembaga yang akan segera berakhir atau sudah kadaluarsa."
        return msg

    msg += f"📊 *Ringkasan:*\n"
    msg += f"⚠️ Segera Berakhir (≤{THRESHOLD_DAYS} hari): *{len(segera)} lembaga*\n"
    msg += f"🔴 Sudah Berakhir: *{len(kadaluarsa)} lembaga*\n"

    if segera:
        msg += f"\n━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"⚠️ *SEGERA BERAKHIR:*\n"
        msg += f"━━━━━━━━━━━━━━━━━━━━\n"
        for d in segera[:20]:
            end_str = format_date(d.get('jangka_waktu'))
            msg += f"\n📌 [{d['tab_label']}] *{d['nama']}*\n"
            msg += f"   📦 {d['kategori']}\n"
            msg += f"   ⏰ {end_str} ({d['days_left']} hari lagi)\n"
        if len(segera) > 20:
            msg += f"\n   ...dan {len(segera) - 20} lainnya.\n"

    if kadaluarsa:
        msg += f"\n━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"🔴 *SUDAH BERAKHIR:*\n"
        msg += f"━━━━━━━━━━━━━━━━━━━━\n"
        for d in kadaluarsa[:15]:
            end_str = format_date(d.get('jangka_waktu'))
            msg += f"\n❌ [{d['tab_label']}] *{d['nama']}*\n"
            msg += f"   📦 {d['kategori']}\n"
            msg += f"   📅 {end_str} ({abs(d['days_left'])} hari lalu)\n"
        if len(kadaluarsa) > 15:
            msg += f"\n   ...dan {len(kadaluarsa) - 15} lainnya.\n"

    return msg


# ============================================================
# SEND
# ============================================================

def send_telegram(token: str, chat_id: str, message: str) -> bool:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {'chat_id': chat_id, 'text': message, 'parse_mode': 'Markdown'}
    try:
        resp   = requests.post(url, json=payload, timeout=15)
        result = resp.json()
        if result.get('ok'):
            print(f"✅ Notifikasi berhasil dikirim! (message_id: {result['result']['message_id']})")
            return True
        else:
            print(f"❌ Gagal: {result.get('description', 'Unknown error')}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Error: Tidak ada koneksi internet.")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description='Notifikasi Telegram untuk Monitoring LSPro & Lab Uji'
    )
    parser.add_argument(
        '--rekap',
        action='store_true',
        help='Kirim rekap LENGKAP (semua segera berakhir + sudah berakhir). '
             'Tanpa flag ini, hanya kirim jika ada yang BARU masuk hari ini.'
    )
    args = parser.parse_args()

    print("=" * 55)
    if args.rekap:
        print("  Mode: REKAP LENGKAP")
    else:
        print("  Mode: OTOMATIS (hanya baru masuk hari ini)")
    print("=" * 55)

    # Validasi konfigurasi
    if not BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN belum diisi di file .env")
        sys.exit(1)
    if not CHAT_ID:
        print("❌ ERROR: TELEGRAM_CHAT_ID belum diisi di file .env")
        sys.exit(1)

    print(f"📂 Membaca: {DATA_FILE}")
    data     = load_data(DATA_FILE)
    all_items = enrich(data)

    if args.rekap:
        # --- Mode rekap: kirim semua ---
        segera_count     = sum(1 for d in all_items if d['status'] == 'segera')
        kadaluarsa_count = sum(1 for d in all_items if d['status'] == 'kadaluarsa')
        print(f"⚠️  Segera berakhir : {segera_count} lembaga")
        print(f"🔴 Sudah kadaluarsa: {kadaluarsa_count} lembaga")
        message = build_message_rekap(all_items)
        print(f"\n📤 Mengirim rekap ke Telegram...")
        send_telegram(BOT_TOKEN, CHAT_ID, message)

    else:
        # --- Mode otomatis: hanya yang baru masuk hari ini ---
        new_entries = get_new_entries(all_items)
        print(f"🆕 Baru masuk Segera Berakhir hari ini: {len(new_entries)} lembaga")
        if not new_entries:
            print("✅ Tidak ada yang baru masuk — notifikasi tidak dikirim.")
        else:
            for d in new_entries:
                print(f"   → [{d['tab_label']}] {d['nama']} ({d['kategori']})")
            message = build_message_otomatis(new_entries)
            print(f"\n📤 Mengirim notifikasi ke Telegram...")
            send_telegram(BOT_TOKEN, CHAT_ID, message)

    print("=" * 55)


if __name__ == '__main__':
    main()
