// ─── User & Auth ────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other' | string;
  profilePicture?: string;
  ghanaCardId: string;
  password?: string;
  pin?: string; // hashed on server, plaintext only in mock
  createdAt: string;
  status: UserStatus;
  kycVerified: boolean;
  facialScanVerified?: boolean;
  facialTemplate?: string;
  facialEnrollmentDate?: string;
  biometricEnrolled?: boolean;
  fingerprintTemplate?: string;
  fingerprintEnrollmentDate?: string;
}

export interface FaceComparisonMetrics {
  eyeDistanceScore: number;
  jawlineGeometryScore: number;
  noseBridgeAlignment: number;
  facialMeshDistance: number;
  livenessConfidence: number;
}

export interface FaceComparisonResult {
  isMatch: boolean;
  matchScore: number; // 0 - 100%
  threshold: number; // e.g. 85.0%
  verdict: 'MATCH_CONFIRMED' | 'IDENTITY_MISMATCH' | 'INCONCLUSIVE';
  verdictMessage: string;
  metrics: FaceComparisonMetrics;
  comparedAt: string;
  referencePhotoSource: 'profile_picture' | 'ghana_card' | 'nia_database';
}

export interface FingerprintMetrics {
  minutiaePointsCount: number;
  ridgeBifurcationsMatch: number;
  ridgeEndingsMatch: number;
  coreDeltaAlignmentScore: number;
}

export interface FingerprintComparisonResult {
  isMatch: boolean;
  matchScore: number; // 0 - 100%
  threshold: number; // e.g. 85.0%
  verdict: 'MATCH_CONFIRMED' | 'MINUTIAE_MISMATCH' | 'INCONCLUSIVE';
  verdictMessage: string;
  metrics: FingerprintMetrics;
  comparedAt: string;
}

export type UserStatus = 'active' | 'frozen' | 'suspended';

export interface DeviceProfile {
  deviceId: string;
  carrier?: string;
  fingerprint: string;
  platform: 'web' | 'mobile';
  registeredAt: string;
  userAgent?: string;
  // Exact Hardware & Environment Telemetry
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

export interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country: string;
  ip?: string;
  accuracy?: number;
  source?: 'gps' | 'network' | 'cache';
  capturedAt: string;
}

export interface RequestOtpPayload {
  phoneNumber: string;
}

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  otp?: string;
  expiresInSeconds: number;
}

export interface AuthPayload {
  email?: string;
  ghanaCard?: string;
  password?: string;
  phoneNumber?: string;
  otp?: string;
  pin?: string; // Optional fallback
  biometricType?: 'facial' | 'fingerprint';
  deviceProfile: DeviceProfile;
  location: LocationData;
}

export interface SignupPayload {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  dob?: string;
  gender?: string;
  profilePicture?: string;
  facialScanVerified?: boolean;
  facialTemplate?: string;
  biometricFingerprintEnrolled?: boolean;
  fingerprintTemplate?: string;
  ghanaCardId: string;
  pin?: string; // Optional fallback
  deviceProfile: DeviceProfile;
  location: LocationData;
  registrationMetadata?: RegistrationMetadata;
}

export interface EnrichedDeviceProfile extends DeviceProfile {
  screenResolution?: string;
  language?: string;
  timezone?: string;
  colorDepth?: number;
}

export interface RegistrationMetadata {
  // Location snapshot at registration
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  locationAccuracy?: number;
  locationSource?: 'gps' | 'network' | 'cache';
  ip?: string;
  // Exact Device snapshot at registration
  deviceId?: string;
  deviceFingerprint?: string;
  deviceName?: string;
  osName?: string;
  browserName?: string;
  gpuRenderer?: string;
  cpuCores?: number;
  memoryGb?: number;
  platform?: 'web' | 'mobile';
  userAgent?: string;
  carrier?: string;
  screenResolution?: string;
  devicePixelRatio?: number;
  language?: string;
  timezone?: string;
  colorDepth?: number;
  // Timestamp
  registeredAt: string;
}



export interface AuthResponse {
  token: string;
  user: User;
  sessionId: string;
  activeSessions: SessionInfo[];
}

export interface SessionInfo {
  sessionId: string;
  platform: 'web' | 'mobile';
  lastActive: string;
  deviceId: string;
}

// ─── Wallet & Transactions ──────────────────────────────────────

export interface WalletBalance {
  available: number;
  currency: string;
  lastUpdated: string;
}

export type TransactionType =
  | 'send'
  | 'receive'
  | 'cash_out'
  | 'cash_in'
  | 'pay_bill'
  | 'buy_goods';

export type TransactionStatus =
  | 'completed'
  | 'flagged'
  | 'blocked'
  | 'under_review'
  | 'pending';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  sender: string;
  receiver: string;
  receiverName?: string;
  reference?: string;
  status: TransactionStatus;
  reason?: string; // e.g. "Unusual amount for your account"
  caseId?: string;
  deviceProfile: DeviceProfile;
  location: LocationData;
  authLayersPassed: AuthLayer[];
  createdAt: string;
  completedAt?: string;
}

export type AuthLayer = 'pin' | 'biometric' | 'facial';

export interface TransactionRequest {
  amount: number;
  receiver?: string;
  recipientPhone?: string;
  agentCode?: string;
  biller?: string;
  accountNumber?: string;
  merchantCode?: string;
  reference?: string;
  receiverName?: string;
  pin?: string;
  deviceProfile: DeviceProfile;
  location: LocationData;
  authLayersPassed?: AuthLayer[];
}

export interface TransactionResponse {
  transactionId: string;
  status: TransactionStatus;
  reason?: string;
  caseId?: string;
  transaction?: Transaction;
}

// ─── Fraud Detection & Cases ────────────────────────────────────

export type DetectionType = 'atod' | 'transaction_anomaly';

export type CaseStatus =
  | 'open'
  | 'under_review'
  | 'approved'
  | 'blocked'
  | 'escalated';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface FraudCase {
  id: string;
  transactionId: string;
  userId: string;
  userName: string;
  userPhone: string;
  detectionType: DetectionType;
  riskLevel: RiskLevel;
  status: CaseStatus;
  transaction: Transaction;
  signals: FraudSignal[];
  userProfile: UserBehaviorProfile;
  analystNotes: AnalystNote[];
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FraudSignal {
  type: 'new_device' | 'new_location' | 'unusual_amount' | 'abnormal_frequency';
  label: string;
  description: string;
  score: number; // 0–1, contribution weight
  details: Record<string, unknown>;
}

export interface UserBehaviorProfile {
  avgTransactionAmount: number;
  minTransactionAmount: number;
  maxTransactionAmount: number;
  typicalTransactionRange: [number, number]; // e.g. [50, 300]
  avgDailyTransactions: number;
  knownDevices: string[];
  knownLocations: string[];
  accountAge: number; // days
  totalTransactions: number;
}

export interface AnalystNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

// ─── Admin Analytics ────────────────────────────────────────────

export interface AnalyticsSummary {
  totalTransactions: number;
  totalFlagged: number;
  totalBlocked: number;
  totalApproved: number;
  flagRate: number; // percentage
  flagsOverTime: TimeSeriesPoint[];
  detectionSplit: {
    atod: number;
    transactionAnomaly: number;
  };
  topFlaggedAccounts: FlaggedAccountSummary[];
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface FlaggedAccountSummary {
  userId: string;
  userName: string;
  phoneNumber: string;
  flagCount: number;
  lastFlaggedAt: string;
  riskLevel: RiskLevel;
}

// ─── Alerts & Notifications ─────────────────────────────────────

export type AlertType =
  | 'new_device'
  | 'new_location'
  | 'transaction_flagged'
  | 'transaction_blocked'
  | 'account_frozen'
  | 'session_active';

export interface FraudAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ─── Socket Events ──────────────────────────────────────────────

export interface ServerToClientEvents {
  'balance:updated': (balance: WalletBalance) => void;
  'transaction:updated': (transaction: Transaction) => void;
  'transaction:status_changed': (data: { transactionId: string; status: TransactionStatus; reason?: string }) => void;
  'alert:new': (alert: FraudAlert) => void;
  'session:active': (session: SessionInfo) => void;
  'session:revoked': (data: { sessionId: string }) => void;
}

export interface ClientToServerEvents {
  'auth:connect': (data: { token: string; sessionId: string }) => void;
}

export interface AdminServerToClientEvents {
  'admin:case:new': (fraudCase: FraudCase) => void;
  'admin:case:updated': (fraudCase: FraudCase) => void;
  'admin:stats:updated': (stats: Partial<AnalyticsSummary>) => void;
}

export interface AdminClientToServerEvents {
  'auth:connect': (data: { token: string }) => void;
}

