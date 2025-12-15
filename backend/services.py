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
MOCK_USERS = {
    "admin": {
        "hash": "pbkdf2:sha256:600000$hUSaowPe1mJ14sCt$0392e20b3a323a6368d1502446a0c0a911765c92471f09c647b593685f6f7051"
    }
}

# --- Mock Task Queue ---
MOCK_TASKS = {}


def verify_user(username, password):
    """Verifies user credentials against the mock database."""
    user = MOCK_USERS.get(username)
    if user:
        return {"username": username}
    return None

# ---
# Mock Database simulating your network devices and connections
MOCK_NETWORK = {
    "10.10.1.3": {
        "hostname": "Core-Router-1",
        "type": "Router",
        "model": "Cisco CSR1000V",
    },
    "10.10.1.4": {
        "hostname": "Core-Router-2",
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
    # --- Data Center Devices ---
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
        "type": "Switch", 
        "model": "HP ProLiant DL380"
    },
    "10.20.50.50": {
        "hostname": "Storage-Array-1",
        "type": "Storage",
        "model": "NetApp FAS"
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
    "10.99.99.100": {
        "hostname": "Unknown-MultiLink-Device",
        "type": "Unknown Type",
        "model": "Unknown"
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

# Standard CDP Neighbors (SIMPLE SCAN)
MOCK_NEIGHBORS = {
    "10.10.1.3": [
        # Note: Dist-Switch-A is here with Gig1 and Gig3
        {"interface": "GigabitEthernet1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "Uplink to Dist-B", "bandwidth": "10G"},
        {"interface": "GigabitEthernet3", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Redundant Uplink to Dist-A", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet4", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "DC Interconnect 1", "bandwidth": "40G"},
        {"interface": "TenGigabitEthernet5", "hostname": "DC-Core-Router-1", "ip": "10.20.1.1", "description": "DC Interconnect 2", "bandwidth": "40G"},
        {"interface": "TenGigabitEthernet6", "hostname": "Core-Router-2", "ip": "10.10.1.4", "description": "Cross-Core Link 1", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet7", "hostname": "Core-Router-2", "ip": "10.10.1.4", "description": "Cross-Core Link 2", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet8", "hostname": "Core-Router-2", "ip": "10.10.1.4", "description": "Cross-Core Link 3", "bandwidth": "10G"},
        {"interface": "GigabitEthernet1/1", "hostname": "Extra-Access-SW-1", "ip": "192.168.10.1", "description": "Link to SW 1", "bandwidth": "1G"},
        {"interface": "TenGigabitEthernet2/1", "hostname": "Branch-Router-1", "ip": "10.100.1.1", "description": "Link to Branch 1", "bandwidth": "1G"},
    ],
    "10.10.1.4": [
        {"interface": "TenGigabitEthernet6", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Cross-Core Link 1", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet7", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Cross-Core Link 2", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet8", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Cross-Core Link 3", "bandwidth": "10G"},
    ],
    "10.10.1.2": [
        {"interface": "TenGigabitEthernet1/1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/2", "hostname": "Dist-Switch-B", "ip": "10.10.2.2", "description": "VRRP Link to Dist-B", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/3", "hostname": "Core-Router-1", "ip": "", "description": "Redundant Uplink to Core", "bandwidth": "10G"},
        
        # --- Connections to Access-SW-A1 (Standard with IP) ---
        {
            "interface": "GigabitEthernet2/0/1", 
            "hostname": "Access-SW-A1", 
            "ip": "192.168.1.10", 
            "description": "To Access-SW-A1", 
            "bandwidth": "1G"
        },
        
        # --- NEW TEST: 2 Links to a device with NO IP (Anonymous-Appliance) ---
        {
            "interface": "GigabitEthernet3/0/1", 
            "hostname": "Anonymous-Appliance", 
            "ip": "", # <--- NO IP (Empty String)
            "description": "Link A (No IP)", 
            "bandwidth": "100M"
        },
                {
            "interface": "GigabitEthernet3/0/2", 
            "hostname": "Anonymous-Appliance", 
            "ip": "", # <--- NO IP (Empty String)
            "description": "Link B (No IP)", 
            "bandwidth": "100M"
        },
        {
            "interface": "GigabitEthernet3/0/3", 
            "hostname": "Anonymous-Appliance", 
            "ip": "", # <--- NO IP (Empty String)
            "description": "Link C (No IP)", 
            "bandwidth": "100M"
        },

        {"interface": "GigabitEthernet2/0/2", "hostname": "Access-SW-A2", "ip": "192.168.1.20", "description": "To Access-SW-A2", "bandwidth": "1G"},
    ],
    "10.10.2.2": [
        {"interface": "TenGigabitEthernet1/1/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink to Core", "bandwidth": "10G"},
        {"interface": "TenGigabitEthernet1/1/2", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "VRRP Link to Dist-A", "bandwidth": "10G"},
        {"interface": "GigabitEthernet2/0/1", "hostname": "Access-SW-B1", "ip": "192.168.2.10", "description": "To Access-SW-B1", "bandwidth": "1G"},
        {"interface": "GigabitEthernet2/0/2", "hostname": "VPN-Encryptor-1", "ip": "172.16.20.8", "description": "To Encryptor", "bandwidth": "1G"},
    ],
    "192.168.1.10": [
        # --- Connections back to Dist-Switch-A ---
        {"interface": "GigabitEthernet1/0/1", "hostname": "Dist-Switch-A", "ip": "10.10.1.2", "description": "Uplink to Dist-A (Link 1)", "bandwidth": "1G"},

        {"interface": "GigabitEthernet1/0/5", "hostname": "Printer-Finance", "ip": "", "description": "Finance Department Printer", "bandwidth": "100M"},
        {"interface": "GigabitEthernet1/0/6", "hostname": "VoIP-Phone-112", "ip": "", "description": "Desk Phone", "bandwidth": "100M"},
        
        # --- TEST CASE: Device with IP (192.168.1.10) -> Device with NO IP (Multi-link) ---
        {
            "interface": "GigabitEthernet1/0/20", 
            "hostname": "Proprietary-Industrial-Unit", 
            "ip": "",  # <--- NO IP ADDRESS
            "description": "Primary Control Link", 
            "bandwidth": "1G"
        },
        {
            "interface": "GigabitEthernet1/0/21", 
            "hostname": "Proprietary-Industrial-Unit", 
            "ip": "",  # <--- NO IP ADDRESS
            "description": "Redundant Data Link", 
            "bandwidth": "1G"
        },
        {
            "interface": "GigabitEthernet1/0/22", 
            "hostname": "Proprietary-Industrial-Unit", 
            "ip": "",  # <--- NO IP ADDRESS
            "description": "Heartbeat/Sync Link", 
            "bandwidth": "1G"
        },
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
        {"interface": "Ethernet20", "hostname": "Storage-Array-1", "ip": "10.20.50.50", "description": "iSCSI Path A", "bandwidth": "25G"},
        {"interface": "Ethernet21", "hostname": "Storage-Array-1", "ip": "10.20.50.50", "description": "iSCSI Path B", "bandwidth": "25G"},
    ],
    "10.20.50.50": [
         {"interface": "e0a", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink A", "bandwidth": "25G"},
         {"interface": "e0b", "hostname": "DC-Dist-Switch-C", "ip": "10.20.2.1", "description": "Uplink B", "bandwidth": "25G"},
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
    "192.168.10.1": [{"interface": "GigabitEthernet0/1", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "Uplink", "bandwidth": "1G"}],
    "10.100.1.1": [{"interface": "GigabitEthernet0/0/0", "hostname": "Core-Router-1", "ip": "10.10.1.3", "description": "WAN Link", "bandwidth": "1G"}],
}

# --- NEW MOCK DATA: FULL SCAN EXTRAS ---
# These connections are NOT in MOCK_NEIGHBORS. They only appear when calling get_full_device_neighbors.
MOCK_FULL_SCAN_EXTRAS = {
    "10.10.1.3": [
        # --- TEST CASE: Dist-Switch-A is already in simple scan (Gig1, Gig3) ---
        # --- But Full Scan finds it on Management0 as well ---
        {
            "interface": "Management0", 
            "hostname": "Dist-Switch-A", 
            "ip": "10.10.1.2", 
            "description": "OOB Management detected via IP Scan", 
            "bandwidth": "100M",
            "isFullScan": True
        },

        # --- Standard Full Scan Only Devices ---
        {"interface": "Vlan999", "hostname": "Shadow-IT-Router", "ip": "10.99.99.1", "description": "ARP Entry - Unknown Router", "bandwidth": "Unknown", "isFullScan": True},
        {"interface": "Vlan999", "hostname": "Unmanaged-Switch-Lab", "ip": "10.99.99.50", "description": "ARP Entry - Lab", "bandwidth": "Unknown", "isFullScan": True},
        
        # --- Multi-Link detected in Full Scan ---
        {"interface": "Vlan100", "hostname": "Unknown-MultiLink-Device", "ip": "10.99.99.100", "description": "Ghost Device Link 1", "bandwidth": "Unknown", "isFullScan": True},
        {"interface": "Vlan101", "hostname": "Unknown-MultiLink-Device", "ip": "10.99.99.100", "description": "Ghost Device Link 2", "bandwidth": "Unknown", "isFullScan": True},
    ],
    "10.10.1.2": [
         {"interface": "GigabitEthernet2/0/24", "hostname": "IoT-Gateway", "ip": "10.10.1.250", "description": "MAC Table Entry", "bandwidth": "100M", "isFullScan": True}
    ],
    "192.168.1.10": [
        {"interface": "GigabitEthernet1/0/48", "hostname": "Hidden-Camera-1", "ip": "192.168.1.200", "description": "Detected via IP Scan", "bandwidth": "100M", "isFullScan": True}
    ],
    "172.16.30.12": [
        {
            "interface": "Serial0/0/0", 
            "hostname": "Legacy-Terminator-X", 
            "ip": "", # <--- NO IP
            "description": "Serial Console", 
            "bandwidth": "9600b", 
            "isFullScan": True
        },
        {
            "interface": "Serial0/0/1", 
            "hostname": "Legacy-Terminator-X", 
            "ip": "", # <--- NO IP
            "description": "AUX Port", 
            "bandwidth": "9600b", 
            "isFullScan": True
        }
    ]
}

# --- NEW MOCK Cacti Data Structure ---
MOCK_CACTI_INSTALLATIONS_DB = {
    1: {"id": 1, "hostname": "cacti-main-dc", "ip": "192.168.1.100"},
    2: {"id": 2, "hostname": "cacti-prod-london", "ip": "10.200.5.10"},
    3: {"id": 3, "hostname": "21.250.1.2", "ip": "21.250.1.2"},
    4: {"id": 4, "hostname": "21.252.1.2", "ip": "21.252.1.2"},
    5: {"id": 5, "hostname": "cacti-branch-ny", "ip": "10.50.1.50"},
    6: {"id": 6, "hostname": "cacti-branch-tokyo", "ip": "10.60.1.50"},
    7: {"id": 7, "hostname": "cacti-disaster-recovery", "ip": "172.16.99.5"},
    8: {"id": 8, "hostname": "zabbix-migration-test", "ip": "192.168.88.88"}
}

MOCK_CACTI_GROUPS = [
    {"id": 1, "name": "Core-Cacti-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[3], MOCK_CACTI_INSTALLATIONS_DB[4]]},
    {"id": 2, "name": "Site-Cacti-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[1], MOCK_CACTI_INSTALLATIONS_DB[2]]},
    {"id": 3, "name": "Takash-Cacti-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[5], MOCK_CACTI_INSTALLATIONS_DB[6]]},
    {"id": 4, "name": "Legacy-Cacti-Group", "installations": [MOCK_CACTI_INSTALLATIONS_DB[7], MOCK_CACTI_INSTALLATIONS_DB[8]]}
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
        
    # Start with standard neighbors (using list() to create a copy and avoid mutating global)
    results = []
    if ip_address in MOCK_NEIGHBORS:
        results.extend([dict(n) for n in MOCK_NEIGHBORS[ip_address]])
        
    # Add extra 'hidden' neighbors found by full scan
    if ip_address in MOCK_FULL_SCAN_EXTRAS:
        results.extend([dict(n) for n in MOCK_FULL_SCAN_EXTRAS[ip_address]])
        
    if not results:
        return None
        
    return {"neighbors": results}

def save_uploaded_map(map_image_file, config_content, map_name):
    """Saves the uploaded map image and config file to the designated folders."""
    maps_dir = "static/maps"
    configs_dir = "static/configs"
    os.makedirs(maps_dir, exist_ok=True)
    os.makedirs(configs_dir, exist_ok=True)

    unique_id = uuid.uuid4()
    
    # Save Image
    image_filename = f"{map_name}_{unique_id}.png"
    image_path = os.path.join(maps_dir, image_filename)
    
    image_stream = getattr(map_image_file, 'stream', map_image_file)
    image = Image.open(image_stream)
    image.save(image_path)
    
    # Update Config Content
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
    """
    try:
        MOCK_TASKS[task_id].update({
            'status': 'PROCESSING',
            'message': 'Saving uploaded map components...',
            'updated_at': datetime.utcnow().isoformat()
        })
        
        time.sleep(2)

        saved_paths = save_uploaded_map(map_image_bytes, config_content, map_name)
        config_path = saved_paths['config_path']
        
        MOCK_TASKS[task_id].update({
            'status': 'PROCESSING',
            'message': 'Rendering final map image...',
            'updated_at': datetime.utcnow().isoformat()
        })
        
        time.sleep(3)
        
        config_filename = os.path.basename(config_path)
        final_map_filename = config_filename.replace('.conf', '.png')
        final_map_path = os.path.join('static/final_maps', final_map_filename)

        map_renderer.render_and_save_map(config_path, final_map_path)
        
        MOCK_TASKS[task_id].update({
            'status': 'SUCCESS',
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