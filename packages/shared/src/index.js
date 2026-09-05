/**
 * @momo/shared — barrel export
 */

// Types
export * from './types/index.js';

// Design tokens
export * from './tokens/colors.js';
export * from './tokens/typography.js';

// Constants
export * from './constants/index.js';

// API
export { api, createApiClient, setAuthToken, getAuthToken, setApiBaseUrl } from './api/client.js';
export * from './api/endpoints.js';
export * as adminApi from './api/admin-endpoints.js';

// Utils
export * from './utils/device.js';
export * from './utils/location.js';
export * from './utils/biometrics.js';
export * from './utils/face-detector.js';
export * from './utils/biometricComparison.js';

// Socket
export * from './socket/client.js';
