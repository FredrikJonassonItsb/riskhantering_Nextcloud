#!/bin/bash

# Riskhanterare - Permanent Startup Script
# Startar applikationen med 2 workers och 1 timmes timeout

set -e

PROJECT_DIR="/home/ubuntu/risk-manager"
LOG_DIR="/var/log/riskhanterare"
PID_FILE="/var/run/riskhanterare.pid"

# Skapa log-katalog om den inte finns
if [ ! -d "$LOG_DIR" ]; then
    sudo mkdir -p "$LOG_DIR"
    sudo chown ubuntu:ubuntu "$LOG_DIR"
    sudo chmod 755 "$LOG_DIR"
fi

# Stoppa tidigare instanser
echo "Stoppar tidigare instanser..."
pkill -f "gunicorn.*app:app" || true
sleep 2

# Starta applikationen
echo "Startar Riskhanterare med 2 workers..."
cd "$PROJECT_DIR"

nohup gunicorn \
    -w 2 \
    -b 0.0.0.0:5000 \
    --timeout 3600 \
    --keep-alive 3600 \
    --access-logfile "$LOG_DIR/access.log" \
    --error-logfile "$LOG_DIR/error.log" \
    --log-level info \
    --pid "$PID_FILE" \
    app:app > "$LOG_DIR/startup.log" 2>&1 &

sleep 3

# Verifiera att applikationen är igång
if curl -s http://localhost:5000/api/health | grep -q "ok"; then
    echo "✓ Riskhanterare är igång och svarar"
    echo "✓ URL: https://5000-i7s1sclds3e305qyq952f-258f1df2.manusvm.computer"
    echo "✓ Workers: 2"
    echo "✓ Timeout: 1 timme (3600 sekunder)"
    exit 0
else
    echo "✗ Fel: Applikationen svarar inte"
    tail -20 "$LOG_DIR/error.log"
    exit 1
fi
