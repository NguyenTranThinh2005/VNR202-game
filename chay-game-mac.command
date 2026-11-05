#!/bin/bash
# Bấm đúp để chạy trên macOS (lần đầu: chuột phải > Open)
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  (sleep 1; open http://localhost:3000/admin) & node server.js
elif command -v python3 >/dev/null 2>&1; then
  (sleep 1; open http://localhost:3000/admin) & python3 server.py
else
  echo "Chưa có Node.js hoặc Python. Cài Node.js tại https://nodejs.org rồi chạy lại."
  read -r
fi
