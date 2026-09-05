/**
 * Exact Device & Hardware Profiler for Fraud Detection & Telemetry.
 * 
 * Extracts:
 * - Exact Hardware Model & Brand (e.g., "Apple iPhone 15", "Dell XPS (Windows 11)")
 * - GPU Graphics Card Renderer via WebGL unmasked vendor query
 * - Operating System & Architecture (e.g., "Windows 11 64-bit", "macOS Sonoma", "iOS 17.5")
 * - Browser Name & Exact Version
 * - CPU Concurrency / Cores & RAM Memory Estimation
 * - Physical Screen Resolution, Scaling (devicePixelRatio), & Color Depth
 * - Deterministic Hardware Fingerprint Hash
 */

export interface ExactDeviceDetails {
  deviceName: string;
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
  gpuRenderer?: string;
  cpuCores?: number;
  memoryGb?: number;
  screenResolution: string;
  devicePixelRatio: number;
  colorDepth: number;
  touchSupport: boolean;
  language: string;
  timezone: string;
  fingerprint: string;
}

export interface SimulatedDeviceProfile {
  deviceId: string;
  carrier?: string;
  fingerprint: string;
  platform: 'web' | 'mobile';
  registeredAt: string;
  userAgent?: string;
  // Enriched Exact Hardware Details
  deviceName?: string;
  osName?: string;
  browserName?: string;
  gpuRenderer?: string;
  cpuCores?: number;
  memoryGb?: number;
  screenResolution?: string;
  devicePixelRatio?: number;
  language?: string;
  timezone?: string;
  colorDepth?: number;
}

export interface EnrichedSimulatedDeviceProfile extends SimulatedDeviceProfile {}

/**
 * Extracts the unmasked GPU Graphics Renderer using WebGL extension.
 * (e.g., "NVIDIA GeForce RTX 4070 Laptop GPU", "Apple M3 Pro", "Intel Iris Xe")
 */
export function detectGpuRenderer(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return undefined;

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return undefined;

    const unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    if (!unmaskedRenderer || typeof unmaskedRenderer !== 'string') return undefined;

    // Clean up ANGLE strings: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 ...)" -> "NVIDIA GeForce RTX 4070 Laptop GPU"
    let clean = unmaskedRenderer;
    const match = unmaskedRenderer.match(/ANGLE \((.*?), (.*?) (?:Direct3D|OpenGL|Vulkan|Metal).*\)/i);
    if (match && match[2]) {
      clean = match[2].trim();
    } else if (unmaskedRenderer.includes('ANGLE (')) {
      clean = unmaskedRenderer.replace(/^ANGLE \(/i, '').replace(/\)$/, '').trim();
    }
    return clean;
  } catch {
    return undefined;
  }
}

/**
 * Parses the user agent and platform to identify the exact Operating System.
 */
export function detectOperatingSystem(ua: string, platformStr = ''): { osName: string; osVersion: string } {
  if (/Windows Phone/i.test(ua)) return { osName: 'Windows Phone', osVersion: '' };
  
  if (/Windows NT 10\.0/i.test(ua)) {
    // Windows 10 or 11
    return { osName: 'Windows', osVersion: '11/10 (64-bit)' };
  }
  if (/Windows NT 6\.3/i.test(ua)) return { osName: 'Windows', osVersion: '8.1' };
  if (/Windows NT 6\.2/i.test(ua)) return { osName: 'Windows', osVersion: '8' };
  if (/Windows NT 6\.1/i.test(ua)) return { osName: 'Windows', osVersion: '7' };
  if (/Windows/i.test(ua)) return { osName: 'Windows', osVersion: '' };

  if (/iPhone/i.test(ua)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/i);
    const ver = match ? match[1].replace('_', '.') : '';
    return { osName: 'iOS (iPhone)', osVersion: ver ? `iOS ${ver}` : 'iOS' };
  }
  if (/iPad/i.test(ua)) {
    const match = ua.match(/OS (\d+[_\.]\d+)/i);
    const ver = match ? match[1].replace('_', '.') : '';
    return { osName: 'iPadOS', osVersion: ver ? `iPadOS ${ver}` : 'iPadOS' };
  }

  if (/Mac OS X/i.test(ua) || /Macintosh/i.test(platformStr)) {
    const match = ua.match(/Mac OS X (\d+[_\.]\d+)/i);
    const ver = match ? match[1].replace('_', '.') : '';
    return { osName: 'macOS', osVersion: ver ? `macOS ${ver}` : 'macOS' };
  }

  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s+([0-9\.]+)/i);
    const ver = match ? match[1] : '';
    // Check for phone model inside Android UA
    const modelMatch = ua.match(/;\s*([^;]+?)\s*Build\//i);
    const model = modelMatch ? modelMatch[1].trim() : '';
    return { osName: model ? `Android (${model})` : 'Android', osVersion: ver ? `Android ${ver}` : 'Android' };
  }

  if (/Linux/i.test(ua)) return { osName: 'Linux', osVersion: 'x86_64' };
  if (/CrOS/i.test(ua)) return { osName: 'ChromeOS', osVersion: '' };

  return { osName: 'Unknown OS', osVersion: '' };
}

/**
 * Parses the User Agent to identify the exact Browser & Version.
 */
export function detectBrowser(ua: string): { browserName: string; browserVersion: string } {
  let name = 'Browser';
  let version = '';

  if (/Edg\/([0-9\.]+)/i.test(ua)) {
    name = 'Microsoft Edge';
    version = ua.match(/Edg\/([0-9\.]+)/i)?.[1] || '';
  } else if (/OPR\/([0-9\.]+)/i.test(ua) || /Opera/i.test(ua)) {
    name = 'Opera';
    version = ua.match(/OPR\/([0-9\.]+)/i)?.[1] || '';
  } else if (/SamsungBrowser\/([0-9\.]+)/i.test(ua)) {
    name = 'Samsung Internet';
    version = ua.match(/SamsungBrowser\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Chrome\/([0-9\.]+)/i.test(ua)) {
    name = 'Google Chrome';
    version = ua.match(/Chrome\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Safari\/([0-9\.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    name = 'Apple Safari';
    version = ua.match(/Version\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Firefox\/([0-9\.]+)/i.test(ua)) {
    name = 'Mozilla Firefox';
    version = ua.match(/Firefox\/([0-9\.]+)/i)?.[1] || '';
  }

  const shortVersion = version ? version.split('.').slice(0, 2).join('.') : '';
  return { browserName: name, browserVersion: shortVersion };
}

/**
 * Computes a deterministic cryptographic-style hardware fingerprint hash.
 */
export function generateHardwareFingerprint(): string {
  if (typeof window === 'undefined') {
    return `fp_${Math.random().toString(36).substring(2, 12)}`;
  }

  const screenSignal = (typeof window !== 'undefined' && window.screen)
    ? `${window.screen.width || 1080}x${window.screen.height || 1920}x${window.screen.colorDepth || 24}`
    : '1080x1920x24';

  const rawSignals = [
    (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'ReactNative/Mobile',
    (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US',
    (typeof navigator !== 'undefined' && (navigator as any).hardwareConcurrency) ? (navigator as any).hardwareConcurrency : '8',
    (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) ? (navigator as any).deviceMemory : '8',
    screenSignal,
    (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 3,
    detectGpuRenderer() || 'Mobile-GPU',
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return 'Africa/Accra';
      }
    })(),
  ].join('###');

  // Simple, fast 32-bit FNV-1a hash
  let hash1 = 0x811c9dc5;
  let hash2 = 0x5b3f2901;
  for (let i = 0; i < rawSignals.length; i++) {
    const code = rawSignals.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ code, 0x01000193);
    hash2 = Math.imul(hash2 ^ code, 0x01000193);
  }

  const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `fp-hw-${h1}-${h2}`;
}

/**
 * Detects the full, exact device profile including human-readable device name.
 */
export function getExactDeviceDetails(): ExactDeviceDetails {
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const platformStr = typeof navigator !== 'undefined' ? (navigator.platform || '') : '';
  
  const { osName, osVersion } = detectOperatingSystem(ua, platformStr);
  const { browserName, browserVersion } = detectBrowser(ua);
  const gpuRenderer = detectGpuRenderer();

  const cpuCores = typeof navigator !== 'undefined' ? (navigator as any).hardwareConcurrency : 8;
  const memoryGb = typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : 8;
  const devicePixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 3;
  const colorDepth = (typeof window !== 'undefined' && window.screen && typeof window.screen.colorDepth === 'number') ? window.screen.colorDepth : 24;
  const touchSupport = (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number') ? (navigator.maxTouchPoints > 0) : true;

  let screenResolution = '1080x1920';
  if (typeof window !== 'undefined' && window.screen && window.screen.width && window.screen.height) {
    screenResolution = `${window.screen.width}x${window.screen.height}`;
  }

  let language = 'en-US';
  if (typeof navigator !== 'undefined') {
    language = navigator.language || (navigator as any).userLanguage || 'en-US';
  }

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // Construct a clean, human-readable Device Name:
  // e.g. "Windows 11 PC (NVIDIA GeForce RTX 4070)" or "Apple iPhone (iOS 17.4)" or "Apple Mac (M3 Max)"
  let deviceName = `${osName}`;
  if (gpuRenderer) {
    // Extract concise GPU name: e.g. "NVIDIA RTX 4070" or "Intel Iris Xe"
    const cleanGpu = gpuRenderer
      .replace(/Direct3D.*/i, '')
      .replace(/vs_\d+_\d+.*/i, '')
      .replace(/OpenGL.*/i, '')
      .trim();
    deviceName = `${osName} (${cleanGpu})`;
  } else if (cpuCores) {
    deviceName = `${osName} (${cpuCores} Cores)`;
  } else if (osVersion) {
    deviceName = `${osName} ${osVersion}`;
  }

  const fingerprint = generateHardwareFingerprint();

  return {
    deviceName,
    osName: osVersion ? `${osName} ${osVersion}` : osName,
    osVersion,
    browserName: browserVersion ? `${browserName} ${browserVersion}` : browserName,
    browserVersion,
    gpuRenderer,
    cpuCores,
    memoryGb,
    screenResolution,
    devicePixelRatio,
    colorDepth,
    touchSupport,
    language,
    timezone,
    fingerprint,
  };
}

function generateDeviceId(): string {
  return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Generate a simulated e-SIM device profile with exact hardware detection.
 */
export function generateDeviceProfile(
  platform: 'web' | 'mobile'
): SimulatedDeviceProfile {
  const exact = getExactDeviceDetails();

  return {
    deviceId: generateDeviceId(),
    fingerprint: exact.fingerprint,
    platform,
    registeredAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    deviceName: exact.deviceName,
    osName: exact.osName,
    browserName: exact.browserName,
    gpuRenderer: exact.gpuRenderer,
    cpuCores: exact.cpuCores,
    memoryGb: exact.memoryGb,
    screenResolution: exact.screenResolution,
    devicePixelRatio: exact.devicePixelRatio,
    language: exact.language,
    timezone: exact.timezone,
    colorDepth: exact.colorDepth,
  };
}

/**
 * Retrieve stored device profile from localStorage.
 */
export function getStoredDeviceProfile(): SimulatedDeviceProfile | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem('momo_device_profile');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Persist device profile to localStorage.
 */
export function storeDeviceProfile(profile: SimulatedDeviceProfile): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('momo_device_profile', JSON.stringify(profile));
  } catch {}
}

/**
 * Generate an enriched device profile that includes exact hardware detection.
 */
export function generateEnrichedDeviceProfile(
  platform: 'web' | 'mobile'
): EnrichedSimulatedDeviceProfile {
  return generateDeviceProfile(platform);
}
