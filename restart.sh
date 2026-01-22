#!/bin/bash

# Riskhanterare - Restart Script
# Startar om applikationen

echo "Startar om Riskhanterare..."
bash /home/ubuntu/risk-manager/stop.sh
sleep 2
bash /home/ubuntu/risk-manager/start.sh
