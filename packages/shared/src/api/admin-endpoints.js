/**
 * Endpoint functions for the admin portal.
 * Operates purely client-side using the local simulation store.
 */

import { SimStore } from './store';

// ─── Admin Auth ─────────────────────────────────────────────────

export async function adminLogin(payload) {
  const isKwame = payload.email?.toLowerCase().includes('kwame');
  return {
    token: `admin_jwt_${Date.now()}`,
    analyst: {
      id: 'analyst_001',
      name: isKwame ? 'Kwame Mensah' : 'Swipe Pay Administrator',
      email: payload.email || 'admin@swipepay.gh',
      role: 'admin',
    },
  };
}

// ─── Cases ──────────────────────────────────────────────────────

export async function getCases(params) {
  const cases = SimStore.get().getCases();
  let filtered = [...cases];

  if (params?.status) {
    filtered = filtered.filter((c) => c.status === params.status);
  }
  if (params?.detectionType) {
    filtered = filtered.filter((c) => c.detectionType === params.detectionType);
  }
  if (params?.riskLevel) {
    filtered = filtered.filter((c) => c.riskLevel === params.riskLevel);
  }

  return filtered;
}

export async function getCaseById(caseId) {
  const c = SimStore.get().getCaseById(caseId);
  if (!c) throw new Error(`Case ${caseId} not found`);
  return c;
}

export async function approveCase(caseId, note) {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'approved' });
}

export async function blockCase(caseId, note) {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'blocked' });
}

export async function escalateCase(caseId, note) {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'escalated' });
}

export async function addCaseNote(caseId, content) {
  SimStore.get().addCaseNote(caseId, 'Kwame Mensah', content);
}

// ─── Accounts ───────────────────────────────────────────────────

export async function freezeAccount(_accountId, _reason) {
  return { success: true };
}

// ─── Analytics ──────────────────────────────────────────────────

export async function getAnalytics() {
  return SimStore.get().getAnalytics();
}
