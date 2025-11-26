// frontend/src/config/constants.js

// 1. Import your new icons here
import routerBlackIcon from '../assets/icons/router-black.png';
import routerWhiteIcon from '../assets/icons/router-white.png';
import switchBlackIcon from '../assets/icons/switch-black.png';
import switchWhiteIcon from '../assets/icons/switch-white.png';
import firewallIcon from '../assets/icons/firewall.png';
import unknownIcon from '../assets/icons/firewall.png'; 
import encryptorBlackIcon from '../assets/icons/encryptor-black.png';
import encryptorWhiteIcon from '../assets/icons/encryptor-white.png';

/**
 * Defines the icon assets to be used for each device type, based on the current theme.
 */
export const ICONS_BY_THEME = {
  'Router': { light: routerBlackIcon, dark: routerWhiteIcon },
  'Switch': { light: switchBlackIcon, dark: switchWhiteIcon },
  'Firewall': { light: firewallIcon, dark: firewallIcon },
  'Encryptor': { light: encryptorBlackIcon, dark: encryptorWhiteIcon },  
  'Unknown': { light: unknownIcon, dark: unknownIcon },
};

/**
 * The default device type to suggest for the very first node placed on the map.
 */
export const INITIAL_ICON_NAME = 'Router';

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 140;
export const SNAP_THRESHOLD = 12;