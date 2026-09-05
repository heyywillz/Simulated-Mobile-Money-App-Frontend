/**
 * @momo/shared — barrel export
 */

// Types
export * from './types';

// Design tokens
export * from './tokens/colors';
export * from './tokens/typography';

// Constants
export * from './constants';

// API
export { api, createApiClient, setAuthToken, getAuthToken, setApiBaseUrl } from './api/client';
export * from './api/endpoints';
export * as adminApi from './api/admin-endpoints';

// Utils
export * from './utils/device';
export * from './utils/location';
export * from './utils/biometrics';
export * from './utils/face-detector';
export * from './utils/biometricComparison';

// Socket
export * from './socket/client';
