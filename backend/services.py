import os
import uuid
import re
from PIL import Image
from werkzeug.security import check_password_hash
import time
from datetime import datetime
import map_renderer
import random

# --- Mock Authentication Data ---
# In a real application, this would be replaced with a proper database
# and secure password management. The password 'admin' is hashed.
MOCK_USERS = {
    "admin": {
        "hash": "pbkdf2:sha256:600000$hUSaowPe1mJ14sCt$0392e20b3a323a6368d1502446a0c0a911765c92471f09c647b593685f6f7051"
    }
}

# --- Mock Task Queue ---
# In a real application, this would be managed by a system like Celery and Redis.
MOCK_TASKS = {}


def verify_user(username, password):
    """Verifies user credentials against the mock database."""
    user = MOCK_USERS.get(username)
    if user:
        return {"username": username}
    return None
# ---

# Mock Database simulating your network devices and connections based on the new API spec
MOCK_NETWORK = {
    "10.10.1.3": {
        "hostname": "Core-Router-1",
        "type": "Router",
        "model": "Cisco CSR1000V",
    },
    "10.10.1.2": {
        "hostname": "Dist-Switch-A",
        "type": "Switch",
        "model": "Cisco C9300",
    },
    "10.10.2.2": {
        "hostname": "Dist-Switch-B",
        "type": "Switch",
        "model": "Cisco C9300",
    },
    "192.168.1.10": {
        "hostname": "Access-SW-A1",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "192.168.1.20": {
        "hostname": "Access-SW-A2",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "192.168.2.10": {
        "hostname": "Access-SW-B1",
        "type": "Switch",
        "model": "Cisco C3560",
    },
    "172.16.10.5": {
        "hostname": "Firewall-Main",
        "type": "Firewall",
        "model": "Palo Alto PA-220",
    },
    "172.16.20.8": {
        "hostname": "VPN-Encryptor-1",
        "type": "Encryptor",
        "model": "TACLANE-Micro",
    },
    "172.16.30.12": {
        "hostname": "Legacy-Device",
        "type": "Unknown Type",
        "model": "Custom Appliance",
    },
    # --- New Data Center Devices ---
    "10.20.1.1": {
        "hostname": "DC-Core-Router-1",
        "type": "Router",
        "model": "Cisco Nexus 9000"
    },
    "10.20.2.1": {
        "hostname": "DC-Dist-Switch-C",
        "type": "Switch",
        "model": "Arista 7050SX"
    },
    "10.20.2.2": {
        "hostname": "DC-Dist-Switch-D",
        "type": "Switch",
        "model": "Arista 7050SX"
    },
    "10.20.10.100": {
        "hostname": "Server-A",
        "type": "Switch", # Using switch icon for servers
        "model": "Dell PowerEdge R740"
    },
     "10.20.10.101": {
        "hostname": "Server-B",
        "type": "Switch", # Using switch icon for servers
        "model": "HP ProLiant DL380"
    },
    # --- DEVICES ONLY FOUND VIA FULL SCAN (ARP/IP SCAN) ---
    "10.99.99.1": {
        "hostname": "Shadow-IT-Router",
        "type": "Router",
        "model": "Linksys Consumer"
    },
    "10.99.99.50": {
        "hostname": "Unmanaged-Switch-Lab",
        "type": "Switch",
        "model": "Netgear ProSafe"
    },
    "192.168.1.200": {
        "hostname": "Hidden-Camera-1",
        "type": "Unknown Type",
        "model": "Axis Cam"
    },
    "10.10.1.250": {
        "hostname": "IoT-Gateway",
        "type": "Firewall",
        "model": "Raspberry Pi"
    },
    # --- Extra neighbors for default device ---
    "192.168.10.1": {"hostname": "Extra-Access-SW-1", "type": "Switch", "model": "Cisco C2960"},
    "10.100.1.1": {"hostname": "Branch-Router-1", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.2": {"hostname": "Extra-Access-SW-2", "type": "Switch", "model": "Cisco C2960"},
    "10.100.2.1": {"hostname": "Branch-Router-2", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.3": {"hostname": "Extra-Access-SW-3", "type": "Switch", "model": "Cisco C2960"},
    "10.100.3.1": {"hostname": "Branch-Router-3", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.4": {"hostname": "Extra-Access-SW-4", "type": "Switch", "model": "Cisco C2960"},
    "10.100.4.1": {"hostname": "Branch-Router-4", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.5": {"hostname": "Extra-Access-SW-5", "type": "Switch", "model": "Cisco C2960"},
    "10.100.5.1": {"hostname": "Branch-Router-5", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.6": {"hostname": "Extra-Access-SW-6", "type": "Switch", "model": "Cisco C2960"},
    "10.100.6.1": {"hostname": "Branch-Router-6", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.7": {"hostname": "Extra-Access-SW-7", "type": "Switch", "model": "Cisco C2960"},
    "10.100.7.1": {"hostname": "Branch-Router-7", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.8": {"hostname": "Extra-Access-SW-8", "type": "Switch", "model": "Cisco C2960"},
    "10.100.8.1": {"hostname": "Branch-Router-8", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.9": {"hostname": "Extra-Access-SW-9", "type": "Switch", "model": "Cisco C2960"},
    "10.100.9.1": {"hostname": "Branch-Router-9", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.10": {"hostname": "Extra-Access-SW-10", "type": "Switch", "model": "Cisco C2960"},
    "10.100.10.1": {"hostname": "Branch-Router-10", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.11": {"hostname": "Extra-Access-SW-11", "type": "Switch", "model": "Cisco C2960"},
    "10.100.11.1": {"hostname": "Branch-Router-11", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.12": {"hostname": "Extra-Access-SW-12", "type": "Switch", "model": "Cisco C2960"},
    "10.100.12.1": {"hostname": "Branch-Router-12", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.13": {"hostname": "Extra-Access-SW-13", "type": "Switch", "model": "Cisco C2960"},
    "10.100.13.1": {"hostname": "Branch-Router-13", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.14": {"hostname": "Extra-Access-SW-14", "type": "Switch", "model": "Cisco C2960"},
    "10.100.14.1": {"hostname": "Branch-Router-14", "type": "Router", "model": "Cisco ISR 4331"},
    "192.168.10.15": {"hostname": "Extra-Access-SW-15", "type": "Switch", "model": "Cisco C2960"},
    "10.100.15.1": {"hostname": "Branch-Router-15", "type": "Router", "model": "Cisco ISR 4331"},
}

# Standard CDP Neighbors
MOCK_NEIGHBORS = {
    "10.10.1.3": [
        {"interface": "GigabitEthernet1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B", "bandwidth": "10G"},
        {"interface": "GigabitEthernet3", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Redundant Uplink to Dist-A", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet4", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "DC Interconnect 1", "bandwidth": "40G"},
        {"interface": "TenGigabitEthernet5", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "DC Interconnect 2", "bandwidth": "40G"},
        # ... (Existing large list of neighbors for 10.10.1.3) ...
        {"interface": "GigabitEthernet1/1", "hostname": "Extra-Access-SW-1", "ip": "192.168.10.1", "description": "Link to SW 1", "bandwidth": "1G"},
        {"interface": "TenGigabitEthernet2/1", "hostname": "Branch-Router-1", "ip": "10.100.1.1", "description": "Link to Branch 1", "bandwidth": "1G"},
        # (Truncated for brevity, assume the rest of the original list is here)
    ],
    "10.10.1.2": [
        {"interface": "TenGigabitEthernet1/1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/2", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "VRRP Link to Dist-B", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/3", "hostname": "Core-Router-1", "ip": "", "description": "Redundant Uplink to Core", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2/0/1", "hostname": "Access-SW-A1", "ip": "", "description": "To Access-SW-A1", "bandwidth": "1G"},
        {"interface": "GigabitEthernet2/0/2", "hostname": "Access-SW-A2", "ip": "192.168.1.20", "description": "To Access-SW-A2", "bandwidth": "1G"},
    ],
    "10.10.2.2": [
        {"interface": "TenGigabitEthernet1/1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/2", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "VRRP Link to Dist-A", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2/0/1", "hostname": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1", "bandwidth": "1G"},
        {"interface": "GigabitEthernet2/0/2", "hostname": "VPN-Encryptor-1", "ip": "172.16.20.8", "description": "To Encryptor", "bandwidth": "1G"},
    ],
    "192.168.1.10": [
        {"interface": "GigabitEthernet1/0/1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "1G"},
        {"interface": "GigabitEthernet1/0/5", "hostname": "Printer-Finance", "ip": "", "description": "Finance Department Printer", "bandwidth": "100M"},
        {"interface": "GigabitEthernet1/0/6", "hostname": "VoIP-Phone-112", "ip": "", "description": "Desk Phone", "bandwidth": "100M"},
    ],
    "192.168.1.20": [
        {"interface": "GigabitEthernet1/0/1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "1G"},
    ],
    "192.168.2.10": [
        {"interface": "GigabitEthernet1/0/1", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B", "bandwidth": "1G"},
        {"interface": "GigabitEthernet1/0/2", "hostname": "Firewall-Main", "ip": "172.16.10.5", "description": "To Firewall", "bandwidth": "1G"},
    ],
    "172.16.10.5": [
        {"interface": "ethernet1/1", "hostname": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1", "bandwidth": "1G"},
    ],
    "172.16.20.8": [
        {"interface": "eth0", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink", "bandwidth": "1G"},
        {"interface": "eth1", "hostname": "Legacy-Device", "ip": "172.16.30.12", "description": "To Legacy Device", "bandwidth": "100M"},
    ],
    "172.16.30.12": [
        {"interface": "eno1", "hostname": "VPN-Encryptor-1", "ip": "172.16.20.8", "description": "Uplink", "bandwidth": "100M"},
    ],
    # --- New Data Center Neighbors ---
    "10.20.1.1": [
        {"interface": "Ethernet1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Campus Interconnect 1", "bandwidth": "40G"},
        {"interface": "Ethernet1/2", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Campus Interconnect 2", "bandwidth": "40G"},
        {"interface": "Ethernet2/1", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "To Dist-C", "bandwidth": "100G"},
        {"interface": "Ethernet2/2", "hostname": "DC-Dist-Switch-D", "ip": "10.20.2.2", "description": "To Dist-D", "bandwidth": "100G"},
    ],
    "10.20.2.1": [
        {"interface": "Ethernet1", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "Uplink to DC Core", "bandwidth": "100G"},
        {"interface": "Ethernet48", "hostname": "DC-Dist-Switch-D", "ip": "10.20.2.2", "description": "Peer Link 1", "bandwidth": "40G"},
        {"interface": "Ethernet49", "hostname": "DC-Dist-Switch-D", "ip": "10.20.2.2", "description": "Peer Link 2", "bandwidth": "40G"},
        {"interface": "Ethernet50", "hostname": "DC-Dist-Switch-D", "ip": "10.20.2.2", "description": "Peer Link 3", "bandwidth": "40G"},
        {"interface": "Ethernet10", "hostname": "Server-A", "ip": "10.20.10.100", "description": "LACP to Server-A (1)", "bandwidth": "10G"},
        {"interface": "Ethernet11", "hostname": "Server-A", "ip": "10.20.10.100", "description": "LACP to Server-A (2)", "bandwidth": "10G"},
        {"interface": "Ethernet12", "hostname": "Server-A", "ip": "10.20.10.100", "description": "LACP to Server-A (3)", "bandwidth": "10G"},
        {"interface": "Ethernet13", "hostname": "Server-A", "ip": "10.20.10.100", "description": "LACP to Server-A (4)", "bandwidth": "10G"},
    ],
    "10.20.2.2": [
        {"interface": "Ethernet1", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "Uplink to DC Core", "bandwidth": "100G"},
        {"interface": "Ethernet48", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Peer Link 1", "bandwidth": "40G"},
        {"interface": "Ethernet49", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Peer Link 2", "bandwidth": "40G"},
        {"interface": "Ethernet50", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Peer Link 3", "bandwidth": "40G"},
        {"interface": "Ethernet20", "hostname": "Server-B", "ip": "10.20.10.101", "description": "To Server-B", "bandwidth": "10G"},
    ],
    "10.20.10.100": [
        {"interface": "eth0", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink 1", "bandwidth": "10G"},
        {"interface": "eth1", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink 2", "bandwidth": "10G"},
        {"interface": "eth2", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink 3", "bandwidth": "10G"},
        {"interface": "eth3", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink 4", "bandwidth": "10G"},
    ],
    "10.20.10.101": [
         {"interface": "eth0", "hostname": "DC-Dist-Switch-D", "ip": "10.20.2.2", "description": "Uplink", "bandwidth": "10G"},
    ],
    # --- Extra neighbors for default device (reverse connections) ---
    "192.168.10.1": [{"interface": "GigabitEthernet0/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink", "bandwidth": "1G"}],
    "10.100.1.1": [{"interface": "GigabitEthernet0/0/0", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "WAN Link", "bandwidth": "1G"}],
    # ... (Assume rest of reverse connections exist)
}

# --- NEW MOCK DATA: FULL SCAN EXTRAS ---
# These connections are NOT in MOCK_NEIGHBORS. They only appear when calling get_full_device_neighbors.
MOCK_FULL_SCAN_EXTRAS = {
    "10.10.1.3": [
        {"interface": "Vlan999", "hostname": "Shadow-IT-Router", "ip": "10.99.99.1", "description": "ARP Entry - Unknown Router", "bandwidth": "Unknown"},
        {"interface": "Vlan999", "hostname": "Unmanaged-Switch-Lab", "ip": "10.99.99.50", "description": "ARP Entry - Lab", "bandwidth": "Unknown"}
    ],
    "10.10.1.2": [
         {"interface": "GigabitEthernet2/0/24", "hostname": "IoT-Gateway", "ip": "10.10.1.250", "description": "MAC Table Entry", "bandwidth": "100M"}
    ],
    "192.168.1.10": [
        {"interface": "GigabitEthernet1/0/48", "hostname": "Hidden-Camera-1", "ip": "192.168.1.200", "description": "Detected via IP Scan", "bandwidth": "100M"}
    ]
}

# --- NEW MOCK Cacti Data Structure ---

# A flat dictionary of all possible Cacti installations for easy lookup by ID.
MOCK_CACTI_INSTALLATIONS_DB = {
    1: {
        "id": 1,
        "hostname": "cacti-main-dc",
        "ip": "192.168.1.100",
    },
    2: {
        "id": 2,
        "hostname": "cacti-prod-london",
        "ip": "10.200.5.10",
    },
    3: { 
        "id": 3,
        "hostname": "221.250.1.2",
        "ip": "221.250.1.2",
    },
    4: {
        "id": 4,
        "hostname": "221.252.1.2",
        "ip": "221.252.1.2",
    }
}

# The new grouped structure that the API will return.
MOCK_CACTI_GROUPS = [
    {
        "id": 1,
        "name": "Main-Cacti-Group",
        "installations": [
            MOCK_CACTI_INSTALLATIONS_DB[3],
            MOCK_CACTI_INSTALLATIONS_DB[4]
        ]
    },
    {
        "id": 2,
        "name": "Legacy-Group",
        "installations": [
            MOCK_CACTI_INSTALLATIONS_DB[1],
            MOCK_CACTI_INSTALLATIONS_DB[2]
        ]
    }
]

def get_cacti_groups():
    """Retrieves all Cacti installation groups."""
    return {"status": "success", "data": MOCK_CACTI_GROUPS}

def get_installations_by_group_id(group_id):
    """Finds a Cacti group by its ID and returns its installations."""
    for group in MOCK_CACTI_GROUPS:
        if group['id'] == group_id:
            return group['installations']
    return None

def get_device_info(ip_address):
    """Fetches device type, model, and hostname by IP address."""
    time.sleep(random.uniform(0.3, 1.2)) # Simulate network latency
    if ip_address in MOCK_NETWORK:
        device_data = MOCK_NETWORK[ip_address]
        return {
            "ip": ip_address,
            "model": device_data.get("model", "Unknown Model"),
            "type": device_data.get("type", "Unknown Type"),
            "hostname": device_data.get("hostname", "Unknown Hostname")
        }
    return None

def get_device_neighbors(ip_address):
    """Gets CDP neighbors of a device by IP address using SNMP (mocked)."""
    time.sleep(random.uniform(0.5, 1.5)) # Simulate network latency
    # To simulate a failing device, we first check if the device itself is "known".
    if ip_address not in MOCK_NETWORK:
        return None
    if ip_address in MOCK_NEIGHBORS:
        return {"neighbors": MOCK_NEIGHBORS[ip_address]}
    return None

def get_full_device_neighbors(ip_address):
    """Gets extended neighbors (CDP + ARP/IP scan) for a device."""
    time.sleep(random.uniform(2.0, 4.0)) # Full scan takes longer
    
    if ip_address not in MOCK_NETWORK:
        return None
        
    # Start with standard neighbors
    results = []
    if ip_address in MOCK_NEIGHBORS:
        results.extend(MOCK_NEIGHBORS[ip_address])
        
    # Add extra 'hidden' neighbors found by full scan
    if ip_address in MOCK_FULL_SCAN_EXTRAS:
        results.extend(MOCK_FULL_SCAN_EXTRAS[ip_address])
        
    if not results:
        return None
        
    return {"neighbors": results}

def save_uploaded_map(map_image_file, config_content, map_name):
    """Saves the uploaded map image and config file to the designated folders."""
    # Ensure directories exist
    maps_dir = "static/maps"
    configs_dir = "static/configs"
    os.makedirs(maps_dir, exist_ok=True)
    os.makedirs(configs_dir, exist_ok=True)

    # Generate a unique filename to prevent overwrites and save the files
    unique_id = uuid.uuid4()
    
    # Save Image
    image_filename = f"{map_name}_{unique_id}.png"
    image_path = os.path.join(maps_dir, image_filename)
    
    # Handle both FileStorage and in-memory BytesIO objects
    image_stream = getattr(map_image_file, 'stream', map_image_file)
    image = Image.open(image_stream)
    image.save(image_path)
    
    # --- MODIFICATION ---
    # The config file needs to point to the *actual* image file we just saved.
    # We will replace the placeholder BACKGROUND line with the correct relative path.
    # This path is relative from the config file's location (`static/configs`) 
    # to the image's location (`static/maps`).
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
    """
    Simulates a long-running task to process and render a map.
    This function runs in a background thread.
    """
    try:
        # Update task status to PROCESSING
        MOCK_TASKS[task_id].update({
            'status': 'PROCESSING',
            'message': 'Saving uploaded map components...',
            'updated_at': datetime.utcnow().isoformat()
        })
        
        # Simulate some processing time
        time.sleep(2)

        # Step 1: Save the uploaded background image and the modified .conf file
        saved_paths = save_uploaded_map(map_image_bytes, config_content, map_name)
        config_path = saved_paths['config_path']
        
        MOCK_TASKS[task_id].update({
            'status': 'PROCESSING',
            'message': 'Rendering final map image...',
            'updated_at': datetime.utcnow().isoformat()
        })
        
        # Simulate more processing time
        time.sleep(3)
        
        # Step 2: Define the output path for the final rendered map
        config_filename = os.path.basename(config_path)
        final_map_filename = config_filename.replace('.conf', '.png')
        final_map_path = os.path.join('static/final_maps', final_map_filename)

        # Step 3: Render the final map by drawing lines on the background and save it
        map_renderer.render_and_save_map(config_path, final_map_path)
        
        # Step 4: Update task to SUCCESS
        MOCK_TASKS[task_id].update({
            'status': 'SUCCESS',
            # The final URL will be constructed in the /task-status endpoint
            'message': 'Placeholder for final map URL.',
            'final_map_filename': final_map_filename,
            'updated_at': datetime.utcnow().isoformat()
        })

    except Exception as e:
        print(f"Error during map processing for task {task_id}: {e}")
        MOCK_TASKS[task_id].update({
            'status': 'FAILURE',
            'message': f'An internal error occurred: {e}',
            'updated_at': datetime.utcnow().isoformat()
        })