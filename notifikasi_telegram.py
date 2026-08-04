#!/usr/bin/env python3
"""
notifikasi_telegram.py
======================
Script otomatis untuk mengirim notifikasi status LSPro & Lab Uji ke Telegram.

Cara pakai:
  1. Salin file .env.example → .env
  2. Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di file .env
  3. Jalankan: python notifikasi_telegram.py
  4. (Opsional) Jadwalkan via Windows Task Scheduler untuk notifikasi harian

Requirement: pip install python-dotenv requests
"""

import json
import os
import sys
from datetime import date, datetime

# ---- Load konfigurasi dari .env ----
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Jika python-dotenv tidak terinstall, baca manual
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
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
CHAT_ID   = os.getenv('TELEGRAM_CHAT_ID', '')
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

# Threshold hari untuk "Segera Berakhir"
THRESHOLD_DAYS = 60


def load_data(filepath: str) -> dict:
    """Muat data.json"""
    if not os.path.exists(filepath):
        print(f"ERROR: File tidak ditemukan: {filepath}")
        sys.exit(1)
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_days_left(jangka_waktu: str | None) -> int | None:
    """Hitung sisa hari dari tanggal jangka_waktu"""
    if not jangka_waktu:
        return None
    try:
        end = date.fromisoformat(jangka_waktu[:10])
        return (end - date.today()).days
    except ValueError:
        return None


def classify(days_left: int | None) -> str:
    """Klasifikasikan status berdasarkan sisa hari"""
    if days_left is None:
        return 'aktif'
    if days_left < 0:
        return 'kadaluarsa'
    if days_left <= THRESHOLD_DAYS:
        return 'segera'
    return 'aktif'


def format_date(iso_str: str | None) -> str:
    """Format tanggal ke dd Mon yyyy"""
    if not iso_str:
        return '—'
    try:
        d = date.fromisoformat(iso_str[:10])
        months = ['Jan','Feb','Mar','Apr','Mei','Jun',
                  'Jul','Ags','Sep','Okt','Nov','Des']
        return f"{d.day} {months[d.month-1]} {d.year}"
    except ValueError:
        return iso_str


def build_alert_list(data: dict) -> tuple[list, list]:
    """Kembalikan (segera_list, kadaluarsa_list)"""
    segera_list     = []
    kadaluarsa_list = []

    for tab_key, tab_label in [('lspro', 'LSPro'), ('lab_uji', 'Lab Uji')]:
        for item in data.get(tab_key, []):
            days_left = get_days_left(item.get('jangka_waktu'))
            status    = classify(days_left)
            if status in ('segera', 'kadaluarsa'):
                entry = {**item, 'days_left': days_left, 'status': status, 'tab_label': tab_label}
                if status == 'segera':
                    segera_list.append(entry)
                else:
                    kadaluarsa_list.append(entry)

    segera_list.sort(key=lambda x: x['days_left'] if x['days_left'] is not None else 999)
    kadaluarsa_list.sort(key=lambda x: x['days_left'])

    return segera_list, kadaluarsa_list


def build_message(segera: list, kadaluarsa: list) -> str:
    """Bangun teks pesan Telegram"""
    today_str = datetime.now().strftime('%A, %d %B %Y')
    # Ganti nama hari ke Bahasa Indonesia
    days_id = {
        'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
        'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu', 'Sunday': 'Minggu'
    }
    for en, idn in days_id.items():
        today_str = today_str.replace(en, idn)

    msg = f"🔔 *Monitoring LSPro & Lab Uji ESDM*\n"
    msg += f"📅 {today_str}\n\n"

    total = len(segera) + len(kadaluarsa)
    if total == 0:
        msg += "✅ Tidak ada lembaga yang akan segera berakhir atau sudah kadaluarsa."
        return msg

    msg += f"📊 *Ringkasan:*\n"
    msg += f"⚠️ Segera Berakhir (≤{THRESHOLD_DAYS} hari): *{len(segera)} lembaga*\n"
    msg += f"🔴 Sudah Berakhir: *{len(kadaluarsa)} lembaga*\n"

    if segera:
        msg += f"\n━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"⚠️ *SEGERA BERAKHIR (≤{THRESHOLD_DAYS} hari):*\n"
        msg += f"━━━━━━━━━━━━━━━━━━━━\n"
        for d in segera[:20]:
            end_str = format_date(d.get('jangka_waktu'))
            msg += f"\n📌 [{d['tab_label']}] *{d['nama']}*\n"
            msg += f"   📦 {d['kategori']}\n"
            msg += f"   ⏰ Berakhir: {end_str} ({d['days_left']} hari lagi)\n"
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
            msg += f"   📅 Berakhir: {end_str} ({abs(d['days_left'])} hari lalu)\n"
        if len(kadaluarsa) > 15:
            msg += f"\n   ...dan {len(kadaluarsa) - 15} lainnya.\n"

    return msg


def send_telegram(token: str, chat_id: str, message: str) -> bool:
    """Kirim pesan ke Telegram Bot API"""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        'chat_id':    chat_id,
        'text':       message,
        'parse_mode': 'Markdown'
    }
    try:
        resp = requests.post(url, json=payload, timeout=15)
        result = resp.json()
        if result.get('ok'):
            print(f"✅ Notifikasi berhasil dikirim! (message_id: {result['result']['message_id']})")
            return True
        else:
            print(f"❌ Gagal kirim: {result.get('description', 'Unknown error')}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Error: Tidak ada koneksi internet.")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    print("=" * 50)
    print("  Monitoring LSPro & Lab Uji — Notifikasi Telegram")
    print("=" * 50)

    # Validasi konfigurasi
    if not BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN belum diisi di file .env")
        print("   Salin .env.example → .env dan isi nilainya.")
        sys.exit(1)
    if not CHAT_ID:
        print("❌ ERROR: TELEGRAM_CHAT_ID belum diisi di file .env")
        sys.exit(1)

    print(f"📂 Membaca: {DATA_FILE}")
    data = load_data(DATA_FILE)

    segera, kadaluarsa = build_alert_list(data)
    print(f"⚠️  Segera berakhir (≤{THRESHOLD_DAYS} hari): {len(segera)} lembaga")
    print(f"🔴 Sudah kadaluarsa: {len(kadaluarsa)} lembaga")

    message = build_message(segera, kadaluarsa)

    print(f"\n📤 Mengirim notifikasi ke Telegram...")
    send_telegram(BOT_TOKEN, CHAT_ID, message)

    print("=" * 50)


if __name__ == '__main__':
    main()
