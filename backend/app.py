from flask import Flask, jsonify, request, url_for, Response
from flask_cors import CORS
import services
import os
import map_renderer
import jwt
from functools import wraps
from datetime import datetime, timedelta
import threading
import uuid
from io import BytesIO

app = Flask(__name__)

# --- Authentication Configuration ---
app.config['SECRET_KEY'] = 'your-super-secret-and-complex-key'
CORS(app)

# Ensure directories exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)
os.makedirs('static/final_maps', exist_ok=True)

# --- MOCK USER DATABASE ---
# Roles: 'admin', 'user', 'viewer'
USERS_DB = {
    "1": { "id": "1", "username": "admin", "password": "password", "privilege": "admin" },
    "2": { "id": "2", "username": "user",  "password": "password", "privilege": "user" },
    "3": { "id": "3", "username": "viewer","password": "password", "privilege": "viewer" }
}

# --- DECORATORS ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Malformed Authorization header'}), 401

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # Find user in DB
            request.current_user = next((u for u in USERS_DB.values() if u['username'] == data['user']), None)
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to ensure the user is an admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not request.current_user or request.current_user['privilege'] != 'admin':
            return jsonify({'message': 'Admin privileges required!'}), 403
        return f(*args, **kwargs)
    return decorated

# --- AUTH ENDPOINTS ---
@app.route('/login', methods=['POST'])
def login():
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Missing credentials'}), 401

    username = auth.get('username')
    password = auth.get('password')

    user_found = next((u for u in USERS_DB.values() if u['username'] == username and u['password'] == password), None)

    if user_found:
        token = jwt.encode({
            'user': user_found['username'],
            'role': user_found['privilege'],
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'token': token,
            'user': {
                'id': user_found['id'],
                'username': user_found['username'],
                'privilege': user_found['privilege']
            }
        })

    return jsonify({'message': 'Invalid credentials'}), 401

# --- ADMIN PANEL ENDPOINTS ---
@app.route('/users', methods=['GET'])
@token_required
@admin_required
def get_all_users():
    return jsonify([{'id': u['id'], 'username': u['username'], 'privilege': u['privilege']} for u in USERS_DB.values()])

@app.route('/users/change-privileges/<user_id>/<new_privilege>', methods=['PUT'])
@token_required
@admin_required
def change_privileges(user_id, new_privilege):
    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    
    if new_privilege not in ['admin', 'user', 'viewer']:
        return jsonify({'message': 'Invalid privilege level'}), 400

    USERS_DB[user_id]['privilege'] = new_privilege
    
    return jsonify({
        'message': 'Privilege updated',
        'user': {'id': user_id, 'username': USERS_DB[user_id]['username'], 'privilege': new_privilege}
    })

# --- MAP UPLOAD ENDPOINT (WITH PERMISSION LOGIC) ---
@app.route('/create-map', methods=['POST'])
@token_required
def create_map_endpoint():
    current_privilege = request.current_user['privilege']

    # 1. VIEWER RESTRICTION: Cannot upload at all
    if current_privilege == 'viewer':
        return jsonify({"error": "Permission Denied: Viewers cannot upload maps to Cacti."}), 403

    if 'map_image' not in request.files:
        return jsonify({"error": "Map image is required"}), 400
    
    map_image_file = request.files['map_image']
    map_image_bytes = BytesIO(map_image_file.read())

    cacti_group_id = request.form.get('cacti_group_id')
    map_name = request.form.get('map_name')
    config_content = request.form.get('config_content')

    if not all([cacti_group_id, map_name, config_content]):
        return jsonify({"error": "Missing required form data"}), 400

    try:
        cacti_group_id = int(cacti_group_id)
    except ValueError:
        return jsonify({"error": "Invalid cacti_group_id format"}), 400

    # Retrieve installations for this group
    installations = services.get_installations_by_group_id(cacti_group_id)
    if not installations:
        return jsonify({"error": f"Cacti group with ID {cacti_group_id} not found"}), 404

    # 2. USER RESTRICTION: Cannot upload if server hostname ends in "1"
    if current_privilege == 'user':
        for installation in installations:
            hostname = installation.get('hostname', '').strip()
            # Check if hostname ends with "1" (e.g., "server1", "192.168.0.1")
            if hostname.endswith('1'):
                 return jsonify({
                     "error": f"Permission Denied: Standard Users cannot upload to restricted server '{hostname}'."
                 }), 403

    # ... (Proceed with existing upload logic) ...
    created_tasks = []
    for installation in installations:
        task_id = str(uuid.uuid4())
        services.MOCK_TASKS[task_id] = {
            'id': task_id, 'status': 'PENDING', 'message': 'Queued', 'updated_at': datetime.utcnow().isoformat()
        }
        
        map_image_bytes.seek(0)
        thread_map_image = BytesIO(map_image_bytes.read())

        thread = threading.Thread(
            target=services.process_map_task,
            args=(task_id, thread_map_image, config_content, map_name)
        )
        thread.start()

        created_tasks.append({ "hostname": installation['hostname'], "task_id": task_id })

    return jsonify({
        "message": f"Map creation started for {len(installations)} installations.",
        "tasks": created_tasks
    }), 202

# --- OTHER ENDPOINTS (Groups, Devices, etc.) ---
@app.route('/groups', methods=['GET'])
@token_required
def get_cacti_groups_endpoint():
    return jsonify(services.get_cacti_groups())

@app.route('/api/devices', methods=['POST'])
@token_required
def get_initial_device():
    data = request.get_json()
    device = services.get_device_info(data.get('ip'))
    return jsonify(device) if device else (jsonify({"error": "Not found"}), 404)

@app.route('/get-device-neighbors/<ip>', methods=['GET'])
@token_required
def get_neighbors(ip):
    n = services.get_device_neighbors(ip)
    return jsonify(n) if n else (jsonify({"error": "No neighbors"}), 404)

if __name__ == '__main__':
    app.run(debug=True, port=5000)