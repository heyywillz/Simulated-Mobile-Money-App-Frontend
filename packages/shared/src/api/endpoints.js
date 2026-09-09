/**
 * Endpoint functions for end-user apps.
 *
 * Wiring:
 *   - signup()  → Express POST /
 *   - login()   → Express POST /login
 *   - sendMoney / cashOut / cashIn / payBill / buyGoods → Express POST /transaction
 *   - Everything else (balance, history, alerts, OTP) → local SimStore
 */

import { api } from './client';
import { SimStore, simEvents } from './store';

// ─── Auth ───────────────────────────────────────────────────────

export async function requestOtp(payload) {
  // Express server does not support OTP — simulate locally
  return {
    success: true,
    message: `OTP sent to ${payload.phoneNumber}`,
    otp: '123456',
    expiresInSeconds: 300,
  };
}

export async function getCurrentUser() {
  const store = SimStore.get();
  return store.getUser() || null;
}

function formatGhanaCard(card) {
  if (!card) return 'GHA-000000000-0';
  const clean = String(card).trim().toUpperCase();
  if (/^GHA-\d{9}-\d$/.test(clean)) return clean;
  const digits = clean.replace(/\D/g, '');
  const padded = digits.padEnd(10, '0');
  return `GHA-${padded.slice(0, 9)}-${padded[9]}`;
}

export async function signup(payload) {
  const store = SimStore.get();
  const password = payload.password || payload.pin || '1234';

  const rawPhone = String(payload.phoneNumber || '0240000000').replace(/\D/g, '');
  const validEmail = payload.email && payload.email.includes('@')
    ? payload.email.trim()
    : `${rawPhone || 'user'}@momo.gh`;

  // Map to Express server schema:  POST /
  // { fullName, email, password, ghanaCard, location: {lat, long}, device }
  const expressPayload = {
    fullName: payload.fullName?.trim() || 'Swipe Pay User',
    email: validEmail,
    password,
    ghanaCard: formatGhanaCard(payload.ghanaCardId),
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device: payload.deviceProfile?.deviceName || payload.deviceProfile?.browserName || 'Web Browser',
  };

  try {
    const { data } = await api.post('https://machine-learning-server-3.onrender.com', expressPayload, {
      withCredentials: true,
    });

    // Build user from Express response
    const user = {
      id: data._id || `user_${Date.now()}`,
      fullName: data.fullName || payload.fullName,
      phoneNumber: payload.phoneNumber,
      email: data.email || payload.email,
      dob: payload.dob,
      gender: payload.gender,
      profilePicture: payload.profilePicture,
      ghanaCardId: data.ghanaCard || expressPayload.ghanaCard,
      password,
      pin: payload.pin || password,
      createdAt: data.createdAt || new Date().toISOString(),
      status: 'active',
      kycVerified: true,
      facialScanVerified: payload.facialScanVerified ?? true,
      facialTemplate: payload.facialTemplate,
      facialEnrollmentDate: new Date().toISOString(),
      biometricEnrolled: payload.biometricFingerprintEnrolled ?? true,
      fingerprintTemplate: payload.fingerprintTemplate,
      fingerprintEnrollmentDate: new Date().toISOString(),
    };

    store.setUser(user);
    const initialBal = typeof data.balance === 'number' ? data.balance : 10000.0;
    store.setBalance(initialBal);
    store.setTransactions([]);
    store.setAlerts([]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_sim_balance', String(initialBal));
      localStorage.setItem('momo_sim_transactions', JSON.stringify([]));
      localStorage.setItem('momo_sim_alerts', JSON.stringify([]));
    }

    // Store credentials for later transaction calls
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_user_email', expressPayload.email);
      localStorage.setItem('momo_user_password', expressPayload.password);
      localStorage.setItem('momo_user_ghanaCard', expressPayload.ghanaCard);
    }

    const sessionId = `sess_${Date.now()}`;
    const token = `sim_jwt_${Date.now()}`;

    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  } catch (err) {
    // If Express server fails, fall back to local simulation
    console.warn('Express signup failed, server returned:', err.response?.status, err.response?.data || err.message);
    return signupLocal(payload);
  }
}

export async function login(payload) {
  const store = SimStore.get();

  // Retrieve stored credentials
  const storedEmail =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_email') : null;
  const storedPassword =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_password') : null;
  const storedGhanaCard =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_ghanaCard') : null;

  // Map to Express server schema:  POST /login
  // { email, password, ghanaCard }
  const email =
    payload.email ||
    storedEmail ||
    (payload.phoneNumber ? `${payload.phoneNumber}@momo.gh` : '');
  const password = payload.password || storedPassword || payload.pin || '';
  const ghanaCard = payload.ghanaCard || storedGhanaCard || '';

  const expressPayload = {
    email,
    password,
    ghanaCard,
  };

  try {
    await api.post('/login', expressPayload, { withCredentials: true, timeout: 3000 });

    // Save active credentials in localStorage for subsequent requests
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_user_email', expressPayload.email);
      localStorage.setItem('momo_user_password', expressPayload.password);
      localStorage.setItem('momo_user_ghanaCard', expressPayload.ghanaCard);
    }

    // Express login sets jwt cookie; attempt to fetch real user from /user
    let user = store.getUser();
    try {
      const userRes = await api.get('/user', { withCredentials: true });
      if (userRes.data) {
        user = {
          id: userRes.data._id || `user_${Date.now()}`,
          fullName: userRes.data.fullName || user?.fullName || 'Ama Tetteh',
          phoneNumber: payload.phoneNumber || user?.phoneNumber || '0241234567',
          email: userRes.data.email || expressPayload.email,
          ghanaCardId: userRes.data.ghanaCard || expressPayload.ghanaCard,
          password: expressPayload.password,
          pin: payload.pin || expressPayload.password,
          createdAt: userRes.data.createdAt || new Date().toISOString(),
          status: 'active',
          kycVerified: true,
          facialScanVerified: payload.biometricType === 'facial',
          biometricEnrolled: payload.biometricType === 'fingerprint' || true,
        };
        store.setUser(user);
        if (typeof userRes.data.balance === 'number') {
          store.setBalance(userRes.data.balance);
        }
      }
    } catch {
      // If /user fails, build from payload/store
      if (!user || (payload.email && user.email !== payload.email)) {
        user = {
          id: `user_${Date.now()}`,
          fullName: user?.fullName || 'Ama Tetteh',
          phoneNumber: payload.phoneNumber || user?.phoneNumber || '0241234567',
          email: expressPayload.email,
          ghanaCardId: expressPayload.ghanaCard,
          password: expressPayload.password,
          pin: payload.pin || expressPayload.password,
          createdAt: new Date().toISOString(),
          status: 'active',
          kycVerified: true,
          facialScanVerified: payload.biometricType === 'facial',
          biometricEnrolled: payload.biometricType === 'fingerprint' || true,
        };
        store.setUser(user);
      }
    }

    const sessionId = `sess_${Date.now()}`;
    const token = `sim_jwt_${Date.now()}`;

    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  } catch (err) {
    console.warn('Express login failed, falling back to local user:', err.message);
    let user = store.getUser();
    if (!user) {
      user = {
        id: `user_${Date.now()}`,
        fullName: 'Ama Tetteh',
        phoneNumber: payload.phoneNumber || '0241234567',
        email: expressPayload.email,
        ghanaCardId: expressPayload.ghanaCard,
        password: expressPayload.password,
        pin: payload.pin || expressPayload.password,
        createdAt: new Date().toISOString(),
        status: 'active',
        kycVerified: true,
        facialScanVerified: payload.biometricType === 'facial',
        biometricEnrolled: true,
      };
      store.setUser(user);
    } else {
      user = {
        ...user,
        email: expressPayload.email || user.email,
        ghanaCardId: expressPayload.ghanaCard || user.ghanaCardId,
        password: expressPayload.password || user.password,
      };
      store.setUser(user);
    }
    const sessionId = `sess_${Date.now()}`;
    const token = `sim_jwt_${Date.now()}`;
    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  }
}

export async function registerDevice(_profile) {
  return { success: true };
}

export async function verifyBiometric(_payload) {
  return { verified: true };
}

export async function verifyFacial(_payload) {
  return { verified: true };
}

// ─── Wallet ─────────────────────────────────────────────────────

export async function getBalance() {
  return SimStore.get().getBalance();
}

export async function getTransactions(params) {
  return SimStore.get().getTransactions(params);
}

// ─── Transactions (Express POST /transaction) ───────────────────

let isTransactionPending = false;
let lastTransactionTime = 0;
let lastTransactionKey = '';

async function executeTransaction(type, payload) {
  const store = SimStore.get();
  const user = store.getUser();
  const storedEmail =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_email') : null;
  const storedPw =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_password') : null;

  // Verify entered password matches registered password
  const enteredPassword = payload.password || payload.pin;
  const registeredPassword = user?.password || user?.pin || storedPw;
  if (registeredPassword && enteredPassword && enteredPassword !== registeredPassword) {
    throw new Error('Incorrect password. Please enter the password you created during registration.');
  }

  const currentKey = `${type}_${payload.amount}_${payload.receiver || payload.recipientPhone || payload.agentCode || ''}`;
  const now = Date.now();

  // Deduplication guard: ignore concurrent or identical rapid requests within 2.5s
  if (isTransactionPending || (lastTransactionKey === currentKey && now - lastTransactionTime < 2500)) {
    console.warn('[Transaction] Concurrent or duplicate execution prevented for:', currentKey);
    const recent = store.getTransactions();
    return recent[0] || { status: 'completed' };
  }

  isTransactionPending = true;
  lastTransactionTime = now;
  lastTransactionKey = currentKey;

  const senderRaw = user?.phoneNumber || '0241234567';
  const formattedSenderPhone = senderRaw.startsWith('233-')
    ? senderRaw
    : `233-${senderRaw.replace(/^\+?233|^0/, '')}`;

  const receiverRaw = payload.recipientPhone || payload.receiver || payload.agentCode || payload.merchantCode || '0240000000';
  const formattedReceiverPhone = receiverRaw.startsWith('233-')
    ? receiverRaw
    : `233-${receiverRaw.replace(/^\+?233|^0/, '')}`;

  // Map to Express server schema:  POST /transaction
  // { amount, SenderPhone, receiverPhone, reason, city, country, location, device, email }
  const expressPayload = {
    amount: payload.amount,
    SenderPhone: formattedSenderPhone,
    receiverPhone: formattedReceiverPhone,
    reason: type,
    city: payload.location?.city || 'Accra',
    country: payload.location?.country || 'Ghana',
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device: payload.deviceProfile?.deviceName || payload.deviceProfile?.browserName || 'Web Browser',
    email: storedEmail || user?.email || `${senderRaw}@momo.gh`,
  };

  try {
    const { data } = await api.post('/transaction', expressPayload);

    // Extract ML fraud score from server response
    const rawMlScore = data?.fraud_risk_score ?? data?.prediction ?? data?.detection_score ?? null;
    const mlScore = typeof rawMlScore === 'number' ? Math.min(Math.max(rawMlScore, 0), 1) : null;
    const mlRiskLevel = mlScore !== null
      ? (mlScore >= 0.8 ? 'critical' : mlScore >= 0.6 ? 'high' : mlScore >= 0.3 ? 'medium' : 'low')
      : null;

    // Pass ML data into the local processing so it's stored on the transaction
    const enrichedPayload = { ...payload, mlScore, mlRiskLevel };

    // Process locally to track balance and history
    const result = store.processTransaction(type, enrichedPayload);
    const txId = result.transactionId || result.transaction?.id;

    // If ML score indicates fraud on a transaction that was locally marked completed, upgrade it
    if (mlScore !== null && mlScore >= 0.7 && result.transaction?.status === 'completed' && txId) {
      const caseId = `CASE-ML-${Math.floor(1000 + Math.random() * 9000)}`;
      store.updateTransaction(txId, {
        status: 'flagged',
        mlScore,
        mlRiskLevel,
        reason: `ML fraud engine detected ${(mlScore * 100).toFixed(0)}% risk probability`,
        caseId,
      });

      // Create fraud case for admin
      const updatedTx = store.getAllTransactions().find((t) => t.id === txId);
      const newCase = {
        id: caseId,
        transactionId: txId,
        userId: user?.id,
        userName: user?.fullName || 'Unknown',
        userPhone: user?.phoneNumber || '',
        detectionType: 'transaction_anomaly',
        riskLevel: mlRiskLevel,
        status: 'open',
        transaction: updatedTx || result.transaction,
        signals: [
          {
            type: 'ml_score',
            label: 'ML Fraud Risk Score',
            description: `Machine learning model flagged this transaction with ${(mlScore * 100).toFixed(0)}% fraud probability`,
            score: mlScore,
            details: { model: 'fraud_detection_v1', threshold: 0.7 },
          },
        ],
        userProfile: {
          avgTransactionAmount: 200,
          minTransactionAmount: 10,
          maxTransactionAmount: 500,
          typicalTransactionRange: [20, 500],
          avgDailyTransactions: 2,
          knownDevices: [payload.deviceProfile?.deviceId || 'dev_001'],
          knownLocations: ['Accra', 'Kumasi'],
          accountAge: 90,
          totalTransactions: store.getAllTransactions().length,
        },
        analystNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.cases = [newCase, ...store.cases];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('momo_sim_cases', JSON.stringify(store.cases));
      }
      simEvents.emit('admin:case:new', newCase);

      result.status = 'flagged';
      result.caseId = caseId;
      if (result.transaction) {
        result.transaction.status = 'flagged';
        result.transaction.mlScore = mlScore;
        result.transaction.mlRiskLevel = mlRiskLevel;
      }
    } else if (mlScore !== null && txId) {
      // Attach ML score even for non-flagged transactions
      store.updateTransaction(txId, { mlScore, mlRiskLevel });
    }

    // If server returned updated balance, synchronize store balance with it
    if (data && typeof data.balance === 'number') {
      store.setBalance(data.balance);
    } else if (data && data.user && typeof data.user.balance === 'number') {
      store.setBalance(data.user.balance);
    }

    if (mlScore !== null) {
      console.log(`[ML] fraud_risk_score: ${mlScore} (${mlRiskLevel})`);
    }

    return result;
  } catch (err) {
    console.warn('Express transaction failed, processing locally:', err.response?.data?.message || err.message);
    // Fall back to local processing
    return store.processTransaction(type, payload);
  } finally {
    isTransactionPending = false;
  }
}

export async function sendMoney(payload) {
  return executeTransaction('send', payload);
}

export async function cashOut(payload) {
  return executeTransaction('cash_out', payload);
}

export async function cashIn(payload) {
  return executeTransaction('cash_in', payload);
}

export async function payBill(payload) {
  return executeTransaction('pay_bill', payload);
}

export async function buyGoods(payload) {
  return executeTransaction('buy_goods', payload);
}

// ─── Alerts ─────────────────────────────────────────────────────

export async function getAlerts() {
  return SimStore.get().getAlerts();
}

export async function setAlerts(alerts) {
  SimStore.get().setAlerts(alerts);
}

export async function markAlertRead(alertId) {
  SimStore.get().markAlertRead(alertId);
}

// ─── Local Fallbacks ────────────────────────────────────

function signupLocal(payload) {
  const store = SimStore.get();
  const user = {
    id: `user_${Date.now()}`,
    fullName: payload.fullName,
    phoneNumber: payload.phoneNumber,
    email: payload.email,
    dob: payload.dob,
    gender: payload.gender,
    profilePicture: payload.profilePicture,
    ghanaCardId: payload.ghanaCardId,
    password: payload.password || payload.pin || '1234',
    pin: payload.pin || payload.password || '1234',
    createdAt: new Date().toISOString(),
    status: 'active',
    kycVerified: true,
    facialScanVerified: payload.facialScanVerified ?? true,
    biometricEnrolled: payload.biometricFingerprintEnrolled ?? true,
  };
  store.setUser(user);
  store.setBalance(10000.0);
  store.setTransactions([]);
  store.setAlerts([]);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('momo_sim_balance', '10000');
    localStorage.setItem('momo_sim_transactions', JSON.stringify([]));
    localStorage.setItem('momo_sim_alerts', JSON.stringify([]));
  }
  const sessionId = `sess_${Date.now()}`;
  const token = `sim_jwt_${Date.now()}`;
  return {
    token,
    user,
    sessionId,
    activeSessions: [
      {
        sessionId,
        platform: payload.deviceProfile?.platform || 'web',
        lastActive: new Date().toISOString(),
        deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
      },
    ],
  };
}

function loginLocal(payload) {
  const store = SimStore.get();
  let user = store.getUser();
  if (!user || (payload.phoneNumber && user.phoneNumber !== payload.phoneNumber)) {
    user = {
      id: `user_${Date.now()}`,
      fullName: 'Ama Tetteh',
      phoneNumber: payload.phoneNumber || '0241234567',
      email: payload.email || (payload.phoneNumber ? `${payload.phoneNumber}@momo.gh` : 'aninakwa3144@gmail.com'),
      ghanaCardId: payload.ghanaCard || 'GHA-729183921-4',
      password: payload.password || payload.pin || '@mista223',
      pin: payload.pin || payload.password || '1234',
      createdAt: new Date().toISOString(),
      status: 'active',
      kycVerified: true,
      facialScanVerified: payload.biometricType === 'facial',
      biometricEnrolled: true,
    };
    store.setUser(user);
  }
  const sessionId = `sess_${Date.now()}`;
  const token = `sim_jwt_${Date.now()}`;
  return {
    token,
    user,
    sessionId,
    activeSessions: [
      {
        sessionId,
        platform: payload.deviceProfile?.platform || 'web',
        lastActive: new Date().toISOString(),
        deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
      },
    ],
  };
}
