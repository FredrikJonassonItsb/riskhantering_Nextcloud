#!/bin/bash

# Riskhanterare - Stop Script
# Stoppar applikationen på ett säkert sätt

echo "Stoppar Riskhanterare..."
pkill -f "gunicorn.*app:app" || echo "Ingen process att stoppa"
sleep 2
echo "✓ Riskhanterare stoppat"
