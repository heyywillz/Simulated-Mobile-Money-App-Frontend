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
import { SimStore } from './store';

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

export async function signup(payload) {
  const store = SimStore.get();
  const password = payload.password || payload.pin || '1234';

  // Map to Express server schema:  POST /
  // { fullName, email, password, ghanaCard, location: {lat, long}, device }
  const expressPayload = {
    fullName: payload.fullName,
    email: payload.email || `${payload.phoneNumber}@momo.gh`,
    password,
    ghanaCard: payload.ghanaCardId || 'GHA-000000000-0',
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device: payload.deviceProfile?.deviceName || payload.deviceProfile?.browserName || 'Web Browser',
  };

  try {
    const { data } = await api.post('https://machine-learning-server-ohnz.onrender.com', expressPayload, {
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
      ghanaCardId: data.ghanaCard || payload.ghanaCardId,
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
    if (typeof data.balance === 'number') {
      store.setBalance(data.balance);
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
    console.warn('Express signup failed, falling back to local:', err.message);
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
    await api.post('/login', expressPayload, { withCredentials: true });

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
  const txs = SimStore.get().getTransactions();
  if (params?.status) {
    return txs.filter((t) => t.status === params.status);
  }
  if (params?.limit) {
    return txs.slice(params.offset || 0, (params.offset || 0) + params.limit);
  }
  return txs;
}

// ─── Transactions (Express POST /transaction) ───────────────────

async function executeTransaction(type, payload) {
  const store = SimStore.get();
  const user = store.getUser();
  const storedEmail =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_email') : null;

  // Map to Express server schema:  POST /transaction
  // { amount, SenderPhone, receiverPhone, reason, city, country, location, device, email }
  const expressPayload = {
    amount: payload.amount,
    SenderPhone: user.phoneNumber || '233-241234567',
    receiverPhone: payload.recipientPhone || payload.receiver || payload.agentCode || payload.merchantCode || '233-240000000',
    reason: type,
    city: payload.location?.city || 'Accra',
    country: payload.location?.country || 'Ghana',
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device: payload.deviceProfile?.deviceName || payload.deviceProfile?.browserName || 'Web Browser',
    email: storedEmail || user.email || `${user.phoneNumber}@momo.gh`,
  };

  try {
    const { data } = await api.post('/transaction', expressPayload);

    // Process locally to track balance and history
    const result = store.processTransaction(type, payload);

    // If server returned any fraud info, attach it
    if (data && data.fraud_risk_score !== undefined) {
      console.log('[ML] Server fraud_risk_score:', data.fraud_risk_score);
    }

    return result;
  } catch (err) {
    console.warn('Express transaction failed, processing locally:', err.response?.data?.message || err.message);
    // Fall back to local processing
    return store.processTransaction(type, payload);
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
