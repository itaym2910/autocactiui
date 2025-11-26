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

# --- CORS Fix ---
CORS(app, resources={r"/*": {"origins": "*"}}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])

# Ensure directories exist
os.makedirs('static/maps', exist_ok=True)
os.makedirs('static/configs', exist_ok=True)
os.makedirs('static/final_maps', exist_ok=True)

# --- MOCK USER DATABASE (EXPANDED) ---
# In a real app, this would be a SQL/NoSQL database.
# Passwords are plain text here for demo purposes (Use bcrypt in production!)
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

# --- DECORATORS ---

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200

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
            # Find user by username
            request.current_user = next((u for u in USERS_DB.values() if u['username'] == data['user']), None)
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        
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

# --- AUTH ENDPOINTS ---

@app.route('/login', methods=['POST'])
def login():
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return jsonify({'message': 'Missing credentials'}), 401

    user_found = next((u for u in USERS_DB.values() if u['username'] == auth.get('username') and u['password'] == auth.get('password')), None)

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

# --- NEW: USER MANAGEMENT (REGISTER) ---

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
    
    # Default privilege is 'viewer' unless specified (security best practice)
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

# --- ADMIN PANEL ENDPOINTS ---

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
    """New endpoint to remove a user"""
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200

    if user_id not in USERS_DB:
        return jsonify({'message': 'User not found'}), 404
    
    # Prevent admin from deleting themselves
    if USERS_DB[user_id]['username'] == request.current_user['username']:
        return jsonify({'message': 'You cannot delete your own account'}), 400

    del USERS_DB[user_id]
    return jsonify({'message': 'User deleted successfully'}), 200

# --- MAP UPLOAD ENDPOINT ---

@app.route('/create-map', methods=['POST', 'OPTIONS'])
@token_required
def create_map_endpoint():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200

    if not request.current_user:
        return jsonify({"error": "User authentication failed."}), 401

    current_privilege = request.current_user.get('privilege', 'viewer')

    # 1. Permission Check: Viewers
    if current_privilege == 'viewer':
        return jsonify({"error": "Permission Denied: Viewers cannot upload maps."}), 403

    if 'map_image' not in request.files:
        return jsonify({"error": "Map image is required"}), 400
    
    map_image_file = request.files['map_image']
    map_image_bytes = BytesIO(map_image_file.read())
    cacti_group_id = request.form.get('cacti_group_id')
    map_name = request.form.get('map_name')
    config_content = request.form.get('config_content')

    if not all([cacti_group_id, map_name, config_content]):
        return jsonify({"error": "Missing form data"}), 400

    try:
        cacti_group_id = int(cacti_group_id)
    except ValueError:
        return jsonify({"error": "Invalid ID"}), 400

    installations = services.get_installations_by_group_id(cacti_group_id)
    if not installations:
        return jsonify({"error": "Group not found"}), 404

    # 2. Permission Check: Users & Restricted Servers
    if current_privilege == 'user':
        for installation in installations:
            hostname = installation.get('hostname', '').strip()
            # Logic: Users cannot deploy to servers ending in '1' (e.g., Core routers)
            if hostname.endswith('1'):
                 return jsonify({"error": f"Permission Denied: Users cannot upload to restricted server '{hostname}'."}), 403

    created_tasks = []
    for installation in installations:
        task_id = str(uuid.uuid4())
        services.MOCK_TASKS[task_id] = {'id': task_id, 'status': 'PENDING', 'message': 'Queued', 'updated_at': datetime.utcnow().isoformat()}
        
        map_image_bytes.seek(0)
        thread_map_image = BytesIO(map_image_bytes.read())

        thread = threading.Thread(
            target=services.process_map_task,
            args=(task_id, thread_map_image, config_content, map_name)
        )
        thread.start()
        created_tasks.append({ "hostname": installation['hostname'], "task_id": task_id })

    return jsonify({"message": "Started", "tasks": created_tasks}), 202

# --- OTHER ENDPOINTS ---

@app.route('/config-template', methods=['GET', 'OPTIONS'])
@token_required
def get_config_template_endpoint():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200

    template = """
# AutoCacti Map Creator
BACKGROUND images/backgrounds/%name%.png
WIDTH %width%
HEIGHT %height%
TITLE %name%
KEYTEXTCOLOR 0 0 0
# ... rest of template ...
    """.strip()
    return Response(template, mimetype='text/plain')

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

@app.route('/get-full-neighbors/<ip>', methods=['GET'])
@token_required
def get_full_neighbors(ip):
    n = services.get_full_device_neighbors(ip)
    return jsonify(n) if n else (jsonify({"error": "No neighbors"}), 404)

@app.route('/task-status/<task_id>', methods=['GET'])
@token_required
def get_task_status_endpoint(task_id):
    task = services.MOCK_TASKS.get(task_id)
    if not task: return jsonify({"error": "Task not found"}), 404
    if task['status'] == 'SUCCESS':
        fname = task.get('final_map_filename')
        if fname: task['message'] = url_for('static', filename=f'final_maps/{fname}', _external=True)
    return jsonify(task)

if __name__ == '__main__':
    app.run(debug=True, port=5000)