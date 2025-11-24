import os
import uuid
import re
from PIL import Image
import time
from datetime import datetime
import map_renderer
import random

# --- Mock Database ---
MOCK_USERS = {
    "admin": { "hash": "..." } 
}

MOCK_TASKS = {}

# --- MOCK NETWORK DATA ---
MOCK_NETWORK = {
    "10.10.1.3": { "hostname": "Core-Router-1", "type": "Router", "model": "Cisco CSR1000V" },
    "10.10.1.2": { "hostname": "Dist-Switch-A", "type": "Switch", "model": "Cisco C9300" },
    "10.10.2.2": { "hostname": "Dist-Switch-B", "type": "Switch", "model": "Cisco C9300" },
    "192.168.1.10": { "hostname": "Access-SW-A1", "type": "Switch", "model": "Cisco C3560" },
    "192.168.1.20": { "hostname": "Access-SW-A2", "type": "Switch", "model": "Cisco C3560" },
    "192.168.2.10": { "hostname": "Access-SW-B1", "type": "Switch", "model": "Cisco C3560" },
    "172.16.10.5": { "hostname": "Firewall-Main", "type": "Firewall", "model": "Palo Alto PA-220" },
    "172.16.20.8": { "hostname": "VPN-Encryptor-1", "type": "Encryptor", "model": "TACLANE-Micro" },
    "172.16.30.12": { "hostname": "Legacy-Device", "type": "Unknown Type", "model": "Custom Appliance" },
    "10.20.1.1": { "hostname": "DC-Core-Router-1", "type": "Router", "model": "Cisco Nexus 9000" },
    "10.20.2.1": { "hostname": "DC-Dist-Switch-C", "type": "Switch", "model": "Arista 7050SX" },
    "10.20.2.2": { "hostname": "DC-Dist-Switch-D", "type": "Switch", "model": "Arista 7050SX" },
    "10.20.10.100": { "hostname": "Server-A", "type": "Switch", "model": "Dell PowerEdge R740" },
    "10.20.10.101": { "hostname": "Server-B", "type": "Switch", "model": "HP ProLiant DL380" },
    "10.99.99.1": { "hostname": "Shadow-IT-Router", "type": "Router", "model": "Linksys Consumer" },
    "10.99.99.50": { "hostname": "Unmanaged-Switch-Lab", "type": "Switch", "model": "Netgear ProSafe" },
    "192.168.1.200": { "hostname": "Hidden-Camera-1", "type": "Unknown Type", "model": "Axis Cam" },
    "10.10.1.250": { "hostname": "IoT-Gateway", "type": "Firewall", "model": "Raspberry Pi" },
    "192.168.10.1": {"hostname": "Extra-Access-SW-1", "type": "Switch", "model": "Cisco C2960"},
    "10.100.1.1": {"hostname": "Branch-Router-1", "type": "Router", "model": "Cisco ISR 4331"},
    # ... add more devices as needed
}

MOCK_NEIGHBORS = {
    "10.10.1.3": [
        {"interface": "GigabitEthernet1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet4", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "DC Interconnect 1", "bandwidth": "40G"},
    ],
    "10.10.1.2": [
        {"interface": "TenGigabitEthernet1/1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2/0/2", "hostname": "Access-SW-A2", "ip": "192.168.1.20", "description": "To Access-SW-A2", "bandwidth": "1G"},
    ],
    "192.168.1.10": [
        {"interface": "GigabitEthernet1/0/1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "1G"},
    ],
    # ... add abbreviated neighbors or full list
}

MOCK_FULL_SCAN_EXTRAS = {
    "10.10.1.3": [
        {"interface": "Vlan999", "hostname": "Shadow-IT-Router", "ip": "10.99.99.1", "description": "ARP Entry", "bandwidth": "Unknown"}
    ]
}

MOCK_CACTI_INSTALLATIONS_DB = {
    1: { "id": 1, "hostname": "cacti-main-dc", "ip": "192.168.1.100" },
    2: { "id": 2, "hostname": "cacti-prod-london", "ip": "10.200.5.10" },
    3: { "id": 3, "hostname": "221.250.1.2", "ip": "221.250.1.2" },
    4: { "id": 4, "hostname": "221.252.1.2", "ip": "221.252.1.2" }
}

MOCK_CACTI_GROUPS = [
    { "id": 1, "name": "Main-Cacti-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[3], MOCK_CACTI_INSTALLATIONS_DB[4]] },
    { "id": 2, "name": "Legacy-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[1], MOCK_CACTI_INSTALLATIONS_DB[2]] }
]

# --- LOGIC FUNCTIONS ---

def get_cacti_groups():
    return {"status": "success", "data": MOCK_CACTI_GROUPS}

def get_installations_by_group_id(group_id):
    for group in MOCK_CACTI_GROUPS:
        if group['id'] == group_id:
            return group['installations']
    return None

def get_device_info(ip_address):
    time.sleep(random.uniform(0.3, 0.8))
    if ip_address in MOCK_NETWORK:
        device_data = MOCK_NETWORK[ip_address]
        return {
            "ip": ip_address,
            "model": device_data.get("model", "Unknown"),
            "type": device_data.get("type", "Unknown"),
            "hostname": device_data.get("hostname", "Unknown")
        }
    return None

def get_device_neighbors(ip_address):
    time.sleep(random.uniform(0.3, 0.8))
    if ip_address not in MOCK_NETWORK: return None
    if ip_address in MOCK_NEIGHBORS:
        return {"neighbors": MOCK_NEIGHBORS[ip_address]}
    return None

def get_full_device_neighbors(ip_address):
    time.sleep(random.uniform(1.0, 2.0))
    if ip_address not in MOCK_NETWORK: return None
    results = []
    if ip_address in MOCK_NEIGHBORS: results.extend(MOCK_NEIGHBORS[ip_address])
    if ip_address in MOCK_FULL_SCAN_EXTRAS: results.extend(MOCK_FULL_SCAN_EXTRAS[ip_address])
    if not results: return None
    return {"neighbors": results}

def save_uploaded_map(map_image_file, config_content, map_name):
    maps_dir = "static/maps"
    configs_dir = "static/configs"
    os.makedirs(maps_dir, exist_ok=True)
    os.makedirs(configs_dir, exist_ok=True)

    unique_id = uuid.uuid4()
    
    # Save Image
    image_filename = f"{map_name}_{unique_id}.png"
    image_path = os.path.join(maps_dir, image_filename)
    image_stream = getattr(map_image_file, 'stream', map_image_file)
    Image.open(image_stream).save(image_path)
    
    # Modify Config path
    cacti_image_path = f"../maps/{image_filename}"
    modified_config_content = re.sub(
        r'^(BACKGROUND\s+).*$', 
        fr'\1{cacti_image_path}', 
        config_content, 
        flags=re.MULTILINE
    )

    # Save Config
    config_filename = f"{map_name}_{unique_id}.conf"
    config_path = os.path.join(configs_dir, config_filename)
    with open(config_path, 'w') as f:
        f.write(modified_config_content)

    return {"image_path": image_path, "config_path": config_path}

def process_map_task(task_id, map_image_bytes, config_content, map_name):
    try:
        MOCK_TASKS[task_id].update({'status': 'PROCESSING', 'message': 'Saving map...', 'updated_at': datetime.utcnow().isoformat()})
        time.sleep(1)
        
        saved_paths = save_uploaded_map(map_image_bytes, config_content, map_name)
        config_path = saved_paths['config_path']
        
        MOCK_TASKS[task_id].update({'status': 'PROCESSING', 'message': 'Rendering...', 'updated_at': datetime.utcnow().isoformat()})
        time.sleep(2)
        
        config_filename = os.path.basename(config_path)
        final_map_filename = config_filename.replace('.conf', '.png')
        final_map_path = os.path.join('static/final_maps', final_map_filename)

        map_renderer.render_and_save_map(config_path, final_map_path)
        
        MOCK_TASKS[task_id].update({
            'status': 'SUCCESS',
            'message': 'Done',
            'final_map_filename': final_map_filename,
            'updated_at': datetime.utcnow().isoformat()
        })
    except Exception as e:
        print(f"Task Error: {e}")
        MOCK_TASKS[task_id].update({'status': 'FAILURE', 'message': str(e), 'updated_at': datetime.utcnow().isoformat()})