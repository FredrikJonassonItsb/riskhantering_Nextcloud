# Riskhanterare - Deployment Guide

## 📋 Permanent Deployment

Applikationen är nu konfigurerad för permanent drift med följande specifikationer:

### Konfiguration
- **Workers:** 2 (Gunicorn)
- **Port:** 5000
- **Timeout:** 3600 sekunder (1 timme)
- **Keep-Alive:** 3600 sekunder
- **Bind:** 0.0.0.0:5000

### Startup Scripts

#### Starta applikationen
```bash
bash /home/ubuntu/risk-manager/start.sh
```

#### Stoppa applikationen
```bash
bash /home/ubuntu/risk-manager/stop.sh
```

#### Starta om applikationen
```bash
bash /home/ubuntu/risk-manager/restart.sh
```

### Systemd Service (Optional)

För att köra som systemd-tjänst:

```bash
sudo cp /home/ubuntu/risk-manager/riskhanterare.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable riskhanterare
sudo systemctl start riskhanterare
```

Kontrollera status:
```bash
sudo systemctl status riskhanterare
```

### Loggar

**Startup-logg:**
```bash
tail -f /var/log/riskhanterare/startup.log
```

**Access-logg:**
```bash
tail -f /var/log/riskhanterare/access.log
```

**Error-logg:**
```bash
tail -f /var/log/riskhanterare/error.log
```

### Monitoring

Kontrollera att applikationen svarar:
```bash
curl http://localhost:5000/api/health
```

Kontrollera aktiva processer:
```bash
ps aux | grep gunicorn
```

### Nextcloud Integration

**URL:** https://itsl2.hubs.se

**OAuth Credentials:**
- Client ID: `sKn5cXaRX2EU0Sjn8ws5RVDpa8RvBm8IPuU8URt2eo6KEIAnx5uswvVVjovymhiu`
- Redirect URI: `https://5000-i7s1sclds3e305qyq952f-258f1df2.manusvm.computer/`

**Table ID:** 13

### Environment Variables

Konfigureras i `.env`:
```env
NEXTCLOUD_URL=https://itsl2.hubs.se
NEXTCLOUD_CLIENT_ID=sKn5cXaRX2EU0Sjn8ws5RVDpa8RvBm8IPuU8URt2eo6KEIAnx5uswvVVjovymhiu
NEXTCLOUD_CLIENT_SECRET=<hemlig_nyckel>
NEXTCLOUD_TABLE_ID=13
SECRET_KEY=<hemlig_session_nyckel>
```

### Performance

Med 2 workers kan applikationen hantera:
- ~50-100 samtidiga anslutningar
- ~1000-2000 förfrågningar per minut
- Timeout på 1 timme för långvariga operationer

### Troubleshooting

**Applikationen svarar inte:**
```bash
bash /home/ubuntu/risk-manager/restart.sh
```

**Port redan i användning:**
```bash
lsof -i :5000
pkill -9 -f gunicorn
```

**Kontrollera Python-syntax:**
```bash
python3 -m py_compile /home/ubuntu/risk-manager/app.py
```

**Se senaste loggar:**
```bash
tail -100 /tmp/risk-manager.log
```

### Säkerhet

- OAuth-autentisering via Nextcloud
- Session-baserad autentisering
- CORS-headers konfigurerade
- Timeout-skydd mot långvariga anslutningar

### Uppdateringar

För att uppdatera applikationen:
1. Stoppa applikationen: `bash /home/ubuntu/risk-manager/stop.sh`
2. Uppdatera filer
3. Starta om: `bash /home/ubuntu/risk-manager/restart.sh`

---

**Senast uppdaterad:** 2025-12-16
**Version:** 1.0
**Status:** Production Ready ✅
