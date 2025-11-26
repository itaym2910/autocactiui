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
# In a real production environment, this secret key should be loaded from a secure,
# non-version-controlled location (e.g., environment variables, a vault).
app.config['SECRET_KEY'] = 'your-super-secret-and-complex-key-that-is-not-in-git'
# ---

CORS(app)

# Ensure the directories for storing maps, configs, and final outputs exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)
os.makedirs('static/final_maps', exist_ok=True)

# --- MOCK USER DATABASE (Integrated from File 2) ---
USERS_DB = {
    # System Admins
    "1": { "id": "1", "username": "admin", "password": "password", "privilege": "admin" },
    "4": { "id": "4", "username": "super_admin", "password": "securepass", "privilege": "admin" },
    
    # Standard Users (Can create maps, but restricted on specific servers)
    "2": { "id": "2", "username": "user",  "password": "password", "privilege": "user" },
    "5": { "id": "5", "username": "network_ops", "password": "ops_password", "privilege": "user" },
    "6": { "id": "6", "username": "field_tech", "password": "tech_password", "privilege": "user" },
    
    # Viewers (Read-only access)
    "3": { "id": "3", "username": "viewer","password": "password", "privilege": "viewer" },
    "7": { "id": "7", "username": "guest_monitor", "password": "guest_pass", "privilege": "viewer" },
    "8": { "id": "8", "username": "auditor", "password": "audit_pass", "privilege": "viewer" }
}

# --- Authentication Token Decorators (Updated) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

        token = None
        if 'Authorization' in request.headers:
            # Expected format: "Bearer <token>"
            try:
                auth_header = request.headers['Authorization']
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Malformed Authorization header'}), 401

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Decode the token using the secret key
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # Find user by username and attach to request for RBAC checks
            request.current_user = next((u for u in USERS_DB.values() if u['username'] == data['user']), None)
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

        if not request.current_user or request.current_user.get('privilege') != 'admin':
            return jsonify({'message': 'Admin privileges required!'}), 403
        return f(*args, **kwargs)
    return decorated


# --- Public Authentication Endpoint (Updated to use USERS_DB) ---
@app.route('/login', methods=['POST'])
def login():
    """Authenticates a user and returns a JWT."""
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}

    username = auth.get('username')
    password = auth.get('password')

    # Logic updated to check local USERS_DB to support roles
    user_found = next((u for u in USERS_DB.values() if u['username'] == username and u['password'] == password), None)

    if user_found:
        token = jwt.encode({
            'user': user_found['username'],
            'role': user_found['privilege'], # Include role in token
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

@app.route('/register', methods=['POST'])
def register_user():
    """Allows adding new users dynamically without restarting server"""
    data = request.json
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing username or password'}), 400
    
    # Check if username already exists
    if any(u['username'] == data['username'] for u in USERS_DB.values()):
        return jsonify({'message': 'Username already exists'}), 409

    # Generate new ID
    new_id = str(uuid.uuid4())
    
    # Default privilege is 'viewer' unless specified
    privilege = data.get('privilege', 'viewer')
    if privilege not in ['admin', 'user', 'viewer']:
        return jsonify({'message': 'Invalid privilege. Use admin, user, or viewer'}), 400

    new_user = {
        "id": new_id,
        "username": data['username'],
        "password": data['password'],
        "privilege": privilege
    }

    USERS_DB[new_id] = new_user

    return jsonify({
        'message': 'User registered successfully',
        'user': {'id': new_id, 'username': new_user['username'], 'privilege': new_user['privilege']}
    }), 201

# --- Admin Panel Endpoints (Added from File 2) ---

@app.route('/users', methods=['GET', 'OPTIONS'])
@token_required
@admin_required
def get_all_users():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    return jsonify([{'id': u['id'], 'username': u['username'], 'privilege': u['privilege']} for u in USERS_DB.values()])

@app.route('/users/change-privileges/<user_id>/<new_privilege>', methods=['PUT', 'OPTIONS'])
@token_required
@admin_required
def change_privileges(user_id, new_privilege):
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    
    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    if new_privilege not in ['admin', 'user', 'viewer']:
        return jsonify({'message': 'Invalid privilege level'}), 400

    USERS_DB[user_id]['privilege'] = new_privilege
    return jsonify({
        'message': 'Privilege updated',
        'user': {'id': user_id, 'username': USERS_DB[user_id]['username'], 'privilege': new_privilege}
    })

@app.route('/users/<user_id>', methods=['DELETE', 'OPTIONS'])
@token_required
@admin_required
def delete_user(user_id):
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200

    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    
    # Prevent admin from deleting themselves
    if USERS_DB[user_id]['username'] == request.current_user['username']:
        return jsonify({'message': 'You cannot delete your own account'}), 400

    del USERS_DB[user_id]
    return jsonify({'message': 'User deleted successfully'}), 200


# --- Protected API Endpoints ---
@app.route('/get-device-info/<ip_address>', methods=['GET'])
@token_required
def get_device_info_endpoint(ip_address):
    """Retrieves device type, model, and hostname by IP address."""
    device_info = services.get_device_info(ip_address)
    if device_info:
        return jsonify(device_info)
    return jsonify({"error": "Device not found"}), 404

@app.route('/get-device-neighbors/<ip_address>', methods=['GET'])
@token_required
def get_device_neighbors_endpoint(ip_address):
    """Gets CDP neighbors of a device by IP address using SNMP."""
    neighbors = services.get_device_neighbors(ip_address)
    if neighbors:
        return jsonify(neighbors)
    return jsonify({"error": "Device not found or has no neighbors"}), 404

# --- NEW ENDPOINT FOR FULL SCAN ---
@app.route('/get-full-neighbors/<ip_address>', methods=['GET'])
@token_required
def get_full_device_neighbors_endpoint(ip_address):
    """Gets extended neighbors (CDP + ARP/IP scan) for a device."""
    neighbors = services.get_full_device_neighbors(ip_address)
    if neighbors:
        return jsonify(neighbors)
    return jsonify({"error": "Device not found or has no neighbors"}), 404
# ----------------------------------
    
@app.route('/config-template', methods=['GET'])
@token_required
def get_config_template_endpoint():
    """Returns the Cacti Weathermap configuration template."""
    template = """
# Automatically generated by AutoCacti Map Creator

BACKGROUND images/backgrounds/%name%.png
WIDTH %width%
HEIGHT %height%
TITLE %name%

KEYTEXTCOLOR 0 0 0
KEYOUTLINECOLOR 0 0 0
KEYBGCOLOR 255 255 255
TITLECOLOR 0 0 0
TIMECOLOR 0 0 0
SCALE DEFAULT 0  0   192 192 192
SCALE DEFAULT 0  1   255 255 255
SCALE DEFAULT 1  10  140 0 255
SCALE DEFAULT 10 25  32 32 255
SCALE DEFAULT 25 40  0 192 255
SCALE DEFAULT 40 55  0 240 0
SCALE DEFAULT 55 70  240 240 0
SCALE DEFAULT 70 85  255 192 0
SCALE DEFAULT 85 100 255 0 0

SET key_hidezero_DEFAULT 1

# End of global section

# TEMPLATE-only NODEs:
# TEMPLATE-only LINKs:
LINK DEFAULT
    WIDTH 3
    BWLABEL bits
    BANDWIDTH 10000M

# regular NODEs:
%nodes%

# regular LINKs:
%links%

# That's All Folks!
""".strip()
    return Response(template, mimetype='text/plain')

@app.route('/groups', methods=['GET'])
@token_required
def get_cacti_groups_endpoint():
    """Retrieves all registered Cacti installation groups."""
    groups = services.get_cacti_groups()
    return jsonify(groups)

@app.route('/create-map', methods=['POST'])
@token_required
def create_map_endpoint():
    """
    Accepts map data for a group of Cacti installations, starts multiple background
    processes for rendering, and returns a list of task IDs.
    """
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200

    # --- PRIVILEGE CHECK START ---
    if not request.current_user:
        return jsonify({"error": "User authentication failed."}), 401

    current_privilege = request.current_user.get('privilege', 'viewer')

    # 1. Permission Check: Viewers cannot create maps
    if current_privilege == 'viewer':
        return jsonify({"error": "Permission Denied: Viewers cannot upload maps."}), 403
    # --- PRIVILEGE CHECK END ---

    if 'map_image' not in request.files:
        return jsonify({"error": "Map image is required"}), 400
    
    map_image_file = request.files['map_image']
    map_image_bytes = BytesIO(map_image_file.read())

    cacti_group_id = request.form.get('cacti_group_id')
    map_name = request.form.get('map_name')
    config_content = request.form.get('config_content')

    if not all([cacti_group_id, map_name, config_content]):
        return jsonify({"error": "Missing required form data: cacti_group_id, map_name, or config_content"}), 400

    try:
        cacti_group_id = int(cacti_group_id)
    except ValueError:
        return jsonify({"error": "Invalid cacti_group_id format"}), 400

    installations = services.get_installations_by_group_id(cacti_group_id)
    if not installations:
        return jsonify({"error": f"Cacti group with ID {cacti_group_id} not found"}), 404

    # --- RESTRICTED SERVER CHECK START ---
    # 2. Permission Check: Users & Restricted Servers
    if current_privilege == 'user':
        for installation in installations:
            hostname = installation.get('hostname', '').strip()
            # Logic: Users cannot deploy to servers ending in '1' (e.g., Core routers)
            if hostname.endswith('1'):
                 return jsonify({"error": f"Permission Denied: Users cannot upload to restricted server '{hostname}'."}), 403
    # --- RESTRICTED SERVER CHECK END ---

    created_tasks = []
    
    for installation in installations:
        task_id = str(uuid.uuid4())
        
        services.MOCK_TASKS[task_id] = {
            'id': task_id,
            'status': 'PENDING',
            'message': 'Map creation task has been queued.',
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # We need to create a new BytesIO object for each thread
        map_image_bytes.seek(0)
        thread_map_image = BytesIO(map_image_bytes.read())

        thread = threading.Thread(
            target=services.process_map_task,
            args=(task_id, thread_map_image, config_content, map_name)
        )
        thread.start()

        created_tasks.append({
            "hostname": installation['hostname'],
            "task_id": task_id
        })

    return jsonify({
        "message": f"Map creation process has been started for {len(installations)} installations.",
        "tasks": created_tasks
    }), 202

@app.route('/task-status/<task_id>', methods=['GET'])
@token_required
def get_task_status_endpoint(task_id):
    """Polls for the status of a background task."""
    task = services.MOCK_TASKS.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    # If the task is successful, generate the final map URL dynamically
    if task['status'] == 'SUCCESS':
        final_map_filename = task.get('final_map_filename')
        if final_map_filename:
            task['message'] = url_for('static', filename=f'final_maps/{final_map_filename}', _external=True)

    return jsonify(task)

@app.route('/api/devices', methods=['POST'])
@token_required
def get_initial_device():
    """Endpoint to get the very first device to start the map."""
    data = request.get_json()
    ip = data.get('ip')
    if not ip:
        return jsonify({"error": "IP address is required"}), 400
        
    device = services.get_device_info(ip)
    if device is None:
        return jsonify({"error": "Device not found"}), 404
        
    return jsonify(device)

if __name__ == '__main__':
    app.run(debug=True, port=5000)