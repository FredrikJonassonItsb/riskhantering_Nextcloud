# Extern Riskhanterare för Nextcloud/Hubs

En fristående webbapplikation för hantering av organisatoriska risker enligt riskregistret. Systemet integreras med Nextcloud Tables API för datalagrering och kan köras som External Page i Nextcloud/Hubs.

## Funktionalitet

### Riskhantering
- ✅ Skapa, redigera och ta bort risker
- ✅ Automatisk beräkning av riskvärde (sannolikhet × konsekvens)
- ✅ Risknivåklassificering (Låg, Medel, Hög) med färgkodning
- ✅ Stöd för 5 riskkategorier enligt specifikationen
- ✅ Spårning av riskstatus (Ny, Under behandling, Stängd)

### Visning och Filtrering
- ✅ Tabellvy med alla risker sorterade efter riskvärde
- ✅ Filtrering efter kategori
- ✅ Sökning i titel och beskrivning
- ✅ Filtrering efter status
- ✅ Detaljvisning av varje risk
- ✅ Statistikvy med antal risker per nivå

### Datalagrering
- ✅ Integration med Nextcloud Tables API
- ✅ Säker autentisering via app-lösenord
- ✅ CSV-export av riskregister
- ✅ Centraliserad datalagrering i Nextcloud

## Arkitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Webbläsare                                │
│         (Riskhanterare Frontend - HTML/CSS/JS)              │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────▼────────────────────────────────────────┐
│              Flask Backend (Python)                          │
│  ├─ API-endpoints för risker                                │
│  ├─ Riskvärdesberäkning                                     │
│  ├─ Validering och affärslogik                              │
│  └─ CSV-export                                              │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS + Basic Auth
┌────────────────────▼────────────────────────────────────────┐
│         Nextcloud Tables API                                │
│  ├─ Lagring av riskdata                                     │
│  ├─ Rättighetshantering                                     │
│  └─ Backup & Versioning                                     │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Förutsättningar
- Python 3.8+
- Nextcloud 25+ med Tables-app installerad
- Åtkomst till Nextcloud API

### Steg 1: Klona eller ladda ned projektet

```bash
cd /home/ubuntu/risk-manager
```

### Steg 2: Installera Python-beroenden

```bash
pip install -r requirements.txt
```

### Steg 3: Skapa .env-fil

```bash
cp .env.example .env
```

Redigera `.env` med dina Nextcloud-inställningar:

```env
NEXTCLOUD_URL=https://din-nextcloud-server.tld
NEXTCLOUD_USER=admin
NEXTCLOUD_APP_PASSWORD=ditt_app_lösenord
NEXTCLOUD_TABLE_ID=1
```

### Steg 4: Skapa risktabell i Nextcloud

1. Logga in i Nextcloud
2. Öppna Tables-appen
3. Skapa en ny tabell med följande kolumner:

| Kolumnnamn | Datatyp | Obligatorisk |
|------------|---------|-------------|
| Titel | Text (enradig) | Ja |
| Detaljerad beskrivning | Text (fleraradig) | Nej |
| Kategori | Text/Urvalslista | Ja |
| Sannolikhet | Nummer (1-5) | Ja |
| Konsekvens | Nummer (1-5) | Ja |
| Riskvärde | Nummer | Nej |
| Riskägare/Ansvarig | Text | Nej |
| Åtgärdsplan/Mitigering | Text (fleraradig) | Nej |
| Status | Text/Urvalslista | Nej |
| Identifieringsdatum | Datum | Nej |

4. Notera tabellens ID (visas i URL eller i tabellsettings)
5. Uppdatera `NEXTCLOUD_TABLE_ID` i `.env`

### Steg 5: Skapa app-lösenord i Nextcloud

1. Logga in i Nextcloud
2. Gå till Inställningar → Säkerhet
3. Skapa ett nytt app-lösenord
4. Kopiera lösenordet till `NEXTCLOUD_APP_PASSWORD` i `.env`

### Steg 6: Starta applikationen

```bash
python app.py
```

Applikationen är nu tillgänglig på `http://localhost:5000`

## Integrering med Nextcloud

### Som External Page

För att integrera riskhanteraren som en External Page i Nextcloud:

1. Installera appen "External Pages" i Nextcloud (om inte redan installerad)
2. Gå till Inställningar → External Pages
3. Lägg till en ny sida:
   - **Namn**: Riskhanterare
   - **URL**: `http://din-server:5000`
   - **Ikon**: 📊

### Säkerhet

För produktionsmiljö rekommenderas:

1. **HTTPS**: Kör applikationen bakom en SSL/TLS-proxy
2. **Autentisering**: Lägg till autentisering (t.ex. via OAuth eller HTTP Basic Auth)
3. **Firewall**: Begränsa åtkomst till intern nätverk
4. **VPN**: Kör bakom VPN för extra säkerhet

## API-Dokumentation

### Endpoints

#### Hämta alla risker
```
GET /api/risks
```

**Svar:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Försening av projektleverans",
      "category": "Utveckling",
      "probability": 3,
      "consequence": 4,
      "risk_value": 12,
      "risk_level": {
        "level": "Medel",
        "color": "#ffc107"
      },
      "status": "Under behandling",
      "owner": "Anna Andersson",
      "description": "...",
      "mitigation": "...",
      "created_date": "2024-01-15T10:30:00"
    }
  ]
}
```

#### Filtrera risker
```
GET /api/risks/filter?category=Utveckling
```

#### Skapa ny risk
```
POST /api/risks
Content-Type: application/json

{
  "title": "Ny risk",
  "category": "Drift",
  "description": "Beskrivning...",
  "probability": 2,
  "consequence": 3,
  "owner": "Person",
  "mitigation": "Åtgärd...",
  "status": "Ny",
  "created_date": "2024-01-15"
}
```

#### Uppdatera risk
```
PUT /api/risks/{id}
Content-Type: application/json

{
  "title": "Uppdaterad titel",
  ...
}
```

#### Ta bort risk
```
DELETE /api/risks/{id}
```

#### Exportera till CSV
```
GET /api/export/csv
```

#### Hämta konfiguration
```
GET /api/config
```

## Riskkategorier

Systemet stöder följande riskkategorier enligt specifikationen:

1. **Ledning** - Övergripande styrning och organisation
2. **Utveckling** - Systemutveckling och projektarbete
3. **Drift** - IT-drift och infrastruktur
4. **Informationssäkerhet/Dataskydd** - Säkerhet, GDPR, etc.
5. **Övriga** - Övriga risker

## Riskvärdesberäkning

Riskvärdet beräknas enligt formeln:

```
Riskvärde = Sannolikhet × Konsekvens
```

Där både sannolikhet och konsekvens är värden på en skala 1-5.

### Risknivåer

| Riskvärde | Nivå | Färg |
|-----------|------|------|
| 0-4 | Låg | 🟢 Grön |
| 5-14 | Medel | 🟡 Gul |
| 15-25 | Hög | 🔴 Röd |

## Datalagrering

All riskdata lagras i Nextcloud Tables. Fördelarna med denna arkitektur:

- ✅ Centraliserad lagring
- ✅ Säkerhetskopior via Nextcloud
- ✅ Rättighetshantering via Nextcloud
- ✅ Möjlighet att dela data internt
- ✅ Ingen proprietär databas krävs

## Felsökning

### Anslutningsfel till Nextcloud

**Problem**: "Kunde inte ansluta till Nextcloud"

**Lösning**:
1. Kontrollera att `NEXTCLOUD_URL` är korrekt
2. Verifiera att Nextcloud är tillgängligt
3. Kontrollera användarnamn och app-lösenord
4. Se till att Tables-appen är installerad

### Tabell hittades inte

**Problem**: "Tabell-ID är ogiltigt"

**Lösning**:
1. Verifiera `NEXTCLOUD_TABLE_ID` i `.env`
2. Se till att tabellen finns i Nextcloud
3. Kontrollera att användaren har åtkomst till tabellen

### CORS-fel

**Problem**: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Lösning**:
- CORS är redan aktiverat i Flask-appen
- Om du använder en proxy, se till att CORS-headers vidarebefordras

## Utveckling

### Lokal utveckling

```bash
# Installera dev-beroenden
pip install -r requirements.txt
pip install flask-debugtoolbar

# Starta med debug-läge
FLASK_ENV=development FLASK_DEBUG=True python app.py
```

### Testa API:er

Använd curl eller Postman:

```bash
# Hämta risker
curl -X GET http://localhost:5000/api/risks

# Skapa risk
curl -X POST http://localhost:5000/api/risks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test risk",
    "category": "Utveckling",
    "probability": 2,
    "consequence": 3
  }'
```

## Produktionsdistribution

### Med Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Med Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## Licens

Detta projekt är licensierat under MIT-licensen.

## Support

För frågor eller problem, kontakta systemadministratören eller öppna ett issue i projektets repository.

## Framtida förbättringar

- [ ] Riskmatris-visualisering
- [ ] Trendanalys över tid
- [ ] Automatiska notifikationer
- [ ] Integrering med Nextcloud-användarhantering
- [ ] Rollbaserad åtkomstkontroll (RBAC)
- [ ] Audit-loggning
- [ ] Rapportgenerering (PDF)
- [ ] Mobil-app
