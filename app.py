"""
Extern Riskhanterare för Nextcloud/Hubs - Förenklad version
"""

from flask import Flask, render_template, request, jsonify, send_file, redirect, session, url_for
from flask_cors import CORS
from authlib.integrations.flask_client import OAuth
import requests
import json
import csv
import io
from datetime import datetime
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv
import logging

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-2024')
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

oauth = OAuth(app)

NEXTCLOUD_URL = os.getenv('NEXTCLOUD_URL', 'https://itsl2.hubs.se')
NEXTCLOUD_CLIENT_ID = os.getenv('NEXTCLOUD_CLIENT_ID')
NEXTCLOUD_CLIENT_SECRET = os.getenv('NEXTCLOUD_CLIENT_SECRET')
NEXTCLOUD_TABLE_ID = os.getenv('NEXTCLOUD_TABLE_ID', '13')

nextcloud = oauth.register(
    name='nextcloud',
    client_id=NEXTCLOUD_CLIENT_ID,
    client_secret=NEXTCLOUD_CLIENT_SECRET,
    authorize_url=f'{NEXTCLOUD_URL}/index.php/apps/oauth2/authorize',
    access_token_url=f'{NEXTCLOUD_URL}/index.php/apps/oauth2/api/v1/token',
    client_kwargs={'scope': 'openid profile email'},
)

RISK_CATEGORIES = ['Ledning', 'Utveckling', 'Drift', 'Informationssäkerhet/Dataskydd', 'Övriga']
RISK_STATUS = ['Ny', 'Under behandling', 'Stängd']
RISK_LEVELS = {
    'Låg': {'min': 0, 'max': 4, 'color': '#28a745'},
    'Medel': {'min': 5, 'max': 14, 'color': '#ffc107'},
    'Hög': {'min': 15, 'max': 25, 'color': '#dc3545'}
}

class NextcloudAPI:
    def __init__(self, access_token: str, table_id: str):
        self.access_token = access_token
        self.table_id = table_id
        self.base_url = f"{NEXTCLOUD_URL}/index.php/apps/tables/api/1"
        self.headers = {
            'OCS-APIRequest': 'true',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
    
    def get_rows(self) -> List[Dict]:
        try:
            endpoint = f"{self.base_url}/tables/{self.table_id}/rows"
            response = requests.get(endpoint, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            logger.info(f"API Response type: {type(data)}")
            
            # Hantera båda format
            if isinstance(data, list):
                rows = data
            elif isinstance(data, dict) and 'ocs' in data and 'data' in data['ocs']:
                rows = data['ocs']['data']
            else:
                logger.warning(f"Okänt API-format")
                rows = []
            
            logger.info(f"Hämtade {len(rows)} rader från tabell {self.table_id}")
            return rows
        except Exception as e:
            logger.error(f"Fel vid hämtning av rader: {e}")
            return []
    
    def create_row(self, row_data: Dict) -> Optional[Dict]:
        try:
            # Konvertera kolumnnamn till columnId
            col_map = {
                "Titel": 54,
                "Detaljerad beskrivning": 55,
                "Kategori": 56,
                "Sannolikhet": 57,
                "Konsekvens": 58,
                "Riskvarde": 59,
                "Riskagare/Ansvarig": 60,
                "Atgardsplan/Mitigering": 61,
                "Status": 62,
                "Identifieringsdatum": 63
            }
            
            # Konvertera till Nextcloud-format
            converted_data = {}
            for col_name, value in row_data.items():
                col_id = col_map.get(col_name)
                if col_id:
                    converted_data[col_id] = value
            
            logger.info(f"Skapar rad med data: {converted_data}")
            endpoint = f"{self.base_url}/tables/{self.table_id}/rows"
            response = requests.post(endpoint, headers=self.headers, json={"data": converted_data}, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Fel vid skapande av rad: {e}")
            return None
    
    def update_row(self, row_id: int, row_data: Dict) -> Optional[Dict]:
        try:
            endpoint = f"{self.base_url}/tables/{self.table_id}/rows/{row_id}"
            response = requests.put(endpoint, headers=self.headers, json=row_data, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Fel vid uppdatering av rad: {e}")
            return None
    
    def delete_row(self, row_id: int) -> bool:
        try:
            # Nextcloud Tables API använder /rows/{rowId} för delete
            endpoint = f"{self.base_url}/tables/{self.table_id}/rows/{row_id}"
            logger.info(f"Tar bort rad {row_id} från {endpoint}")
            response = requests.delete(endpoint, headers=self.headers, timeout=10)
            logger.info(f"Delete response status: {response.status_code}")
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Fel vid borttagning av rad: {e}")
            return False

class RiskManager:
    @staticmethod
    def calculate_risk_value(probability: int, consequence: int) -> int:
        return probability * consequence
    
    @staticmethod
    def get_risk_level(risk_value: int) -> Dict:
        for level, config in RISK_LEVELS.items():
            if config['min'] <= risk_value <= config['max']:
                return {'level': level, 'color': config['color']}
        return {'level': 'Okänd', 'color': '#6c757d'}
    
    @staticmethod
    def format_risk(row: Dict) -> Dict:
        data = row.get('data', {})
        
        # Konvertera columnId-format till kolumnnamn
        if isinstance(data, list):
            # Data är en lista med {columnId, value}-objekt
            data_dict = {}
            for item in data:
                col_id = item.get("columnId")
                value = item.get("value")
                # Mappa columnId till kolumnnamn
                col_map = {
                    54: "Titel",
                    55: "Detaljerad beskrivning",
                    56: "Kategori",
                    57: "Sannolikhet",
                    58: "Konsekvens",
                    59: "Riskvärde",
                    60: "Riskägare/Ansvarig",
                    61: "Åtgärdsplan/Mitigering",
                    62: "Status",
                    63: "Identifieringsdatum"
                }
                col_name = col_map.get(col_id, f"col_{col_id}")
                data_dict[col_name] = value
            data = data_dict
        
        
        logger.info(f"Formaterar risk, data: {data}")
        
        try:
            probability = int(data.get('Sannolikhet', 1))
        except (ValueError, TypeError):
            probability = 1
        
        try:
            consequence = int(data.get('Konsekvens', 1))
        except (ValueError, TypeError):
            consequence = 1
        
        risk = {
            'id': row.get('id'),
            'title': str(data.get('Titel', '')),
            'description': str(data.get('Detaljerad beskrivning', '')),
            'category': str(data.get('Kategori', '')),
            'probability': probability,
            'consequence': consequence,
            'owner': str(data.get('Riskägare/Ansvarig', '')),
            'mitigation': str(data.get('Åtgärdsplan/Mitigering', '')),
            'status': str(data.get('Status', 'Ny')),
            'created_date': str(data.get('Identifieringsdatum', datetime.now().isoformat())),
        }
        risk['risk_value'] = RiskManager.calculate_risk_value(risk['probability'], risk['consequence'])
        risk['risk_level'] = RiskManager.get_risk_level(risk['risk_value'])
        return risk

risk_manager = RiskManager()

def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            # För API-anrop, returnera JSON-error
            if request.path.startswith('/api/'):
                return jsonify({'success': False, 'error': 'Inte autentiserad'}), 401
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/login')
def login():
    redirect_uri = url_for('index', _external=True)
    return nextcloud.authorize_redirect(redirect_uri)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/matrix')
@login_required
def matrix():
    return render_template('matrix.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

@app.route('/api/user', methods=['GET'])
def get_user():
    if 'user' not in session:
        return jsonify({'user': None})
    return jsonify({'user': session['user']})

@app.route('/api/risks', methods=['GET'])
@login_required
def get_risks():
    try:
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        rows = nc_api.get_rows()
        logger.info(f"Mottog {len(rows)} rader från API")
        risks = [risk_manager.format_risk(row) for row in rows]
        logger.info(f"Formaterade {len(risks)} risker")
        risks.sort(key=lambda x: x['risk_value'], reverse=True)
        return jsonify(risks)
    except Exception as e:
        logger.error(f"Fel vid hämtning av risker: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/risks/filter', methods=['GET'])
@login_required
def filter_risks():
    category = request.args.get('category', '')
    try:
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        rows = nc_api.get_rows()
        risks = [risk_manager.format_risk(row) for row in rows]
        if category and category != 'Alla':
            risks = [r for r in risks if r['category'] == category]
        risks.sort(key=lambda x: x['risk_value'], reverse=True)
        return jsonify({'success': True, 'data': risks})
    except Exception as e:
        logger.error(f"Fel vid filtrering: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/risks', methods=['POST'])
@login_required
def create_risk():
    try:
        data = request.json
        if not data.get('title') or not data.get('category'):
            return jsonify({'success': False, 'error': 'Titel och kategori är obligatoriska'}), 400
        probability = int(data.get('probability', 1))
        consequence = int(data.get('consequence', 1))
        risk_value = risk_manager.calculate_risk_value(probability, consequence)
        row_data = {
            'Titel': data.get('title', ''),
            'Detaljerad beskrivning': data.get('description', ''),
            'Kategori': data.get('category', ''),
            'Sannolikhet': probability,
            'Konsekvens': consequence,
            'Riskvärde': risk_value,
            'Riskägare/Ansvarig': data.get('owner', ''),
            'Åtgärdsplan/Mitigering': data.get('mitigation', ''),
            'Status': data.get('status', 'Ny'),
            'Identifieringsdatum': data.get('created_date', datetime.now().isoformat())
        }
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        result = nc_api.create_row(row_data)
        if result:
            return jsonify({'success': True, 'data': result})
        else:
            return jsonify({'success': False, 'error': 'Kunde inte skapa risk'}), 500
    except Exception as e:
        logger.error(f"Fel vid skapande av risk: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/risks/<int:risk_id>', methods=['PUT'])
@login_required
def update_risk(risk_id):
    logger.info(f"UPDATE_RISK ANROPAD: risk_id={risk_id}")
    try:
        data = request.json
        logger.info(f"Mottagen data: {data}")
        probability = int(data.get('probability', 1))
        consequence = int(data.get('consequence', 1))
        risk_value = risk_manager.calculate_risk_value(probability, consequence)
        row_data = {
            'Titel': data.get('title', ''),
            'Detaljerad beskrivning': data.get('description', ''),
            'Kategori': data.get('category', ''),
            'Sannolikhet': probability,
            'Konsekvens': consequence,
            'Riskvärde': risk_value,
            'Riskägare/Ansvarig': data.get('owner', ''),
            'Åtgärdsplan/Mitigering': data.get('mitigation', ''),
            'Status': data.get('status', 'Ny'),
            'Identifieringsdatum': data.get('created_date', datetime.now().isoformat())
        }
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        
        logger.info(f"Uppdaterar risk {risk_id} - tar bort och skapar ny")
        success_delete = nc_api.delete_row(risk_id)
        logger.info(f"Delete resultat: {success_delete}")
        if not success_delete:
            logger.warning(f"Kunde inte ta bort risk {risk_id}, fortsatter anda")
        
        result = nc_api.create_row(row_data)
        logger.info(f"Create resultat: {result}")
        if result:
            logger.info(f"Risk uppdaterad (delete+create): {risk_id}")
            return jsonify({'success': True, 'data': result})
        else:
            return jsonify({'success': False, 'error': 'Kunde inte uppdatera risk'}), 500
    except Exception as e:
        logger.error(f"Fel vid uppdatering av risk: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/risks/<int:risk_id>', methods=['DELETE'])
@login_required
def delete_risk(risk_id):
    try:
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        success = nc_api.delete_row(risk_id)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Kunde inte ta bort risk'}), 500
    except Exception as e:
        logger.error(f"Fel vid borttagning av risk: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify({
        'categories': RISK_CATEGORIES,
        'statuses': RISK_STATUS,
        'risk_levels': RISK_LEVELS,
        'probability_scale': {i: f"{i}" for i in range(1, 6)},
        'consequence_scale': {i: f"{i}" for i in range(1, 6)}
    })

@app.route('/api/export/csv', methods=['GET'])
@login_required
def export_csv():
    try:
        access_token = session['user']['access_token']
        nc_api = NextcloudAPI(access_token, NEXTCLOUD_TABLE_ID)
        rows = nc_api.get_rows()
        risks = [risk_manager.format_risk(row) for row in rows]
        risks.sort(key=lambda x: x['risk_value'], reverse=True)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=['ID', 'Titel', 'Kategori', 'Sannolikhet', 'Konsekvens', 'Riskvärde', 'Risknivå', 'Status', 'Ägare', 'Beskrivning', 'Åtgärd', 'Datum'])
        writer.writeheader()
        for risk in risks:
            writer.writerow({
                'ID': risk['id'],
                'Titel': risk['title'],
                'Kategori': risk['category'],
                'Sannolikhet': risk['probability'],
                'Konsekvens': risk['consequence'],
                'Riskvärde': risk['risk_value'],
                'Risknivå': risk['risk_level']['level'],
                'Status': risk['status'],
                'Ägare': risk['owner'],
                'Beskrivning': risk['description'],
                'Åtgärd': risk['mitigation'],
                'Datum': risk['created_date']
            })
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f"riskregister_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
    except Exception as e:
        logger.error(f"Fel vid export: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/')
def index():
    if request.args.get('code'):
        try:
            token = nextcloud.authorize_access_token()
            session['user'] = {
                'id': 'nextcloud_user',
                'name': 'Nextcloud Anvandare',
                'email': '',
                'access_token': token.get('access_token')
            }
            logger.info(f"Anvandare inloggad med OAuth")
        except Exception as e:
            logger.error(f"Autentiseringsfel: {e}")
    
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
