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
# ---

CORS(app)

# Ensure directories exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)
os.makedirs('static/final_maps', exist_ok=True)

# --- MOCK USER DATABASE ---
# We use this to simulate a database. 
# "admin" has high privileges. "user" has low privileges.
USERS_DB = {
    "1": {
        "id": "1", 
        "username": "admin", 
        "password": "admin", # In real life, hash this!
        "privilege": "admin" 
    },
    "2": {
        "id": "2", 
        "username": "user", 
        "password": "user", 
        "privilege": "user"
    },
    "3": {
        "id": "3", 
        "username": "viewer", 
        "password": "view", 
        "privilege": "readonly"
    }
}

# --- DECORATORS ---

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                # Expected format: "Bearer <token>"
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Malformed Authorization header'}), 401

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # Attach the current user to the request context for use in endpoints
            request.current_user = next((u for u in USERS_DB.values() if u['username'] == data['user']), None)
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to ensure the user is an admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # This assumes token_required has already run and set request.current_user
        if not request.current_user or request.current_user['privilege'] != 'admin':
            return jsonify({'message': 'Admin privileges required!'}), 403
        return f(*args, **kwargs)
    return decorated


# --- AUTHENTICATION ENDPOINTS ---

@app.route('/login', methods=['POST'])
def login():
    """Authenticates a user and returns a JWT + User Info."""
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Could not verify'}), 401

    username = auth.get('username')
    password = auth.get('password')

    # Look for user in our Mock DB
    user_found = None
    for user in USERS_DB.values():
        if user['username'] == username and user['password'] == password:
            user_found = user
            break

    if user_found:
        # Generate Token
        token = jwt.encode({
            'user': user_found['username'],
            'role': user_found['privilege'], # Add role to token
            'exp': datetime.utcnow() + timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")

        # Return Token AND User Object (excluding password)
        # The frontend needs the 'user' object to determine if it should show the Admin button
        return jsonify({
            'token': token,
            'user': {
                'id': user_found['id'],
                'username': user_found['username'],
                'privilege': user_found['privilege']
            }
        })

    return jsonify({'message': 'Invalid credentials'}), 401


# --- USER MANAGEMENT ENDPOINTS (ADMIN) ---

@app.route('/users', methods=['GET'])
@token_required
@admin_required # Only admins can list users
def get_all_users():
    """Returns a list of all users."""
    users_list = []
    for u in USERS_DB.values():
        users_list.append({
            'id': u['id'],
            'username': u['username'],
            'privilege': u['privilege']
        })
    return jsonify(users_list)

@app.route('/users/change-privileges/<user_id>/<new_privilege>', methods=['PUT'])
@token_required
@admin_required # Only admins can change privileges
def change_privileges(user_id, new_privilege):
    """Updates a user's privilege level."""
    
    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    
    # Validation (optional)
    if new_privilege not in ['admin', 'user', 'readonly', 'editor']:
        return jsonify({'message': 'Invalid privilege level'}), 400

    # Update the user in our mock DB
    USERS_DB[user_id]['privilege'] = new_privilege
    
    return jsonify({
        'message': 'Privilege updated successfully',
        'user': {
            'id': user_id,
            'username': USERS_DB[user_id]['username'],
            'privilege': new_privilege
        }
    })


# --- DEVICE & MAP ENDPOINTS ---

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

@app.route('/get-full-neighbors/<ip_address>', methods=['GET'])
@token_required
def get_full_device_neighbors_endpoint(ip_address):
    """Gets extended neighbors (CDP + ARP/IP scan) for a device."""
    neighbors = services.get_full_device_neighbors(ip_address)
    if neighbors:
        return jsonify(neighbors)
    return jsonify({"error": "Device not found or has no neighbors"}), 404

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
LINK DEFAULT
    WIDTH 3
    BWLABEL bits
    BANDWIDTH 10000M
%nodes%
%links%
""".strip()
    return Response(template, mimetype='text/plain')

@app.route('/groups', methods=['GET'])
@token_required
def get_cacti_groups_endpoint():
    groups = services.get_cacti_groups()
    return jsonify(groups)

@app.route('/create-map', methods=['POST'])
@token_required
def create_map_endpoint():
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

    installations = services.get_installations_by_group_id(cacti_group_id)
    if not installations:
        return jsonify({"error": f"Cacti group with ID {cacti_group_id} not found"}), 404

    created_tasks = []
    
    for installation in installations:
        task_id = str(uuid.uuid4())
        
        services.MOCK_TASKS[task_id] = {
            'id': task_id,
            'status': 'PENDING',
            'message': 'Map creation task has been queued.',
            'updated_at': datetime.utcnow().isoformat()
        }
        
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
    task = services.MOCK_TASKS.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    if task['status'] == 'SUCCESS':
        final_map_filename = task.get('final_map_filename')
        if final_map_filename:
            task['message'] = url_for('static', filename=f'final_maps/{final_map_filename}', _external=True)

    return jsonify(task)

@app.route('/api/devices', methods=['POST'])
@token_required
def get_initial_device():
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