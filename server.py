#!/usr/bin/env python3
"""
server.py — Admin Local Server
================================
Jalankan file ini untuk membuka halaman Admin Manajemen Data.

  python server.py

Atau klik dua kali: start_admin.bat

Server akan berjalan di: http://localhost:8787
Halaman admin:           http://localhost:8787/admin.html
"""

import json
import os
import subprocess
import threading
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR  = Path(__file__).parent
DATA_FILE = BASE_DIR / 'data.json'
PORT      = 8787


class AdminHandler(BaseHTTPRequestHandler):

    # ---- Suppress default request logs ----
    def log_message(self, fmt, *args):
        pass

    # =========================================================
    # GET — serve static files
    # =========================================================
    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.lstrip('/')

        if path == '' or path == 'admin.html':
            self.serve_file(BASE_DIR / 'admin.html', 'text/html; charset=utf-8')
        elif path == 'admin_lama.html':
            self.serve_file(BASE_DIR / 'admin_lama.html', 'text/html; charset=utf-8')
        elif path == 'admin.js':
            self.serve_file(BASE_DIR / 'admin.js',  'application/javascript; charset=utf-8')
        elif path == 'admin_v3.js':
            self.serve_file(BASE_DIR / 'admin_v3.js',  'application/javascript; charset=utf-8')
        elif path == 'admin.css':
            self.serve_file(BASE_DIR / 'admin.css', 'text/css; charset=utf-8')
        elif path == 'data.json':
            self.serve_file(DATA_FILE, 'application/json; charset=utf-8')
        elif path == 'data_v3.json':
            self.serve_file(BASE_DIR / 'data_v3.json', 'application/json; charset=utf-8')
        elif path == 'style.css':
            self.serve_file(BASE_DIR / 'style.css', 'text/css; charset=utf-8')
        elif path == 'app_v3.js':
            self.serve_file(BASE_DIR / 'app_v3.js', 'application/javascript; charset=utf-8')
        elif path == 'sk_lama.html':
            self.serve_file(BASE_DIR / 'sk_lama.html', 'text/html; charset=utf-8')
        else:
            self.send_error(404, 'Not found')

    def serve_file(self, filepath: Path, content_type: str):
        if not filepath.exists():
            self.send_error(404, f'File not found: {filepath.name}')
            return
        data = filepath.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(data)

    # =========================================================
    # POST — API endpoints
    # =========================================================
    def do_POST(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        length  = int(self.headers.get('Content-Length', 0))
        body    = self.rfile.read(length)
        parsed  = urlparse(self.path)

        if parsed.path == '/api/save':
            self.handle_save(body, is_v3=False)
        elif parsed.path == '/api/save_v3':
            self.handle_save(body, is_v3=True)
        elif parsed.path == '/api/push':
            self.handle_push(body)
        else:
            self.send_error(404, 'API endpoint not found')

    def handle_save(self, body: bytes, is_v3=False):
        """Simpan data.json (atau data_v3.json) ke disk."""
        target_file = BASE_DIR / 'data_v3.json' if is_v3 else DATA_FILE
        try:
            data = json.loads(body.decode('utf-8'))

            # Validasi struktur dasar
            if 'lspro' not in data or 'lab_uji' not in data:
                raise ValueError('Data harus memiliki field lspro dan lab_uji')

            # Tambah/update generated_at
            data['generated_at'] = datetime.now().strftime('%d %b %Y %H:%M')

            # Backup data lama
            backup = BASE_DIR / ('data_v3_backup.json' if is_v3 else 'data_backup.json')
            if target_file.exists():
                backup.write_bytes(target_file.read_bytes())

            # Tulis data baru
            target_file.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )

            self.send_json(200, {
                'ok': True,
                'message': f'Data berhasil disimpan ke {target_file.name}. ({len(data["lspro"])} LSPro, {len(data["lab_uji"])} Lab Uji)',
                'generated_at': data['generated_at']
            })
            print(f'[SAVE] {target_file.name} diperbarui: {len(data["lspro"])} LSPro, {len(data["lab_uji"])} Lab Uji')

        except Exception as e:
            self.send_json(500, {'ok': False, 'message': str(e)})
            print(f'[ERROR] Gagal simpan: {e}')

    def handle_push(self, body: bytes):
        """Jalankan git add + commit + push."""
        try:
            payload    = json.loads(body.decode('utf-8')) if body else {}
            commit_msg = payload.get('message', 'update: data LSPro & Lab Uji diperbarui via Admin Panel')

            steps = [
                (['git', 'add', 'data.json', 'data_v3.json', 'sk_lama.html', 'app_v3.js', 'admin_lama.html', 'admin_v3.js', 'index.html', 'admin.html', 'server.py'], 'git add'),
                (['git', 'commit', '-m', commit_msg], 'git commit'),
                (['git', 'push', 'origin', 'main'], 'git push'),
            ]

            output_log = []
            for cmd, label in steps:
                result = subprocess.run(
                    cmd, cwd=str(BASE_DIR),
                    capture_output=True, text=True
                )
                out = (result.stdout + result.stderr).strip()
                output_log.append(f'[{label}] {out}')
                print(f'[GIT] {label}: {out}')

                # git commit returns 1 jika nothing to commit — bukan error fatal
                if result.returncode != 0 and label != 'git commit':
                    raise RuntimeError(f'{label} gagal:\n{out}')

            self.send_json(200, {
                'ok': True,
                'message': 'Berhasil push ke GitHub!',
                'log': '\n'.join(output_log)
            })

        except Exception as e:
            self.send_json(500, {'ok': False, 'message': str(e)})
            print(f'[ERROR] Git push gagal: {e}')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def send_json(self, code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)


def open_browser():
    import time; time.sleep(0.8)
    webbrowser.open(f'http://localhost:{PORT}/admin.html')


if __name__ == '__main__':
    print('=' * 55)
    print('  Admin Server — Monitoring LSPro & Lab Uji')
    print('=' * 55)
    print(f'  URL   : http://localhost:{PORT}/admin.html')
    print(f'  Folder: {BASE_DIR}')
    print(f'  Tekan Ctrl+C untuk menghentikan server')
    print('=' * 55)

    threading.Thread(target=open_browser, daemon=True).start()

    server = HTTPServer(('localhost', PORT), AdminHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[*] Server dihentikan.')
        server.server_close()
