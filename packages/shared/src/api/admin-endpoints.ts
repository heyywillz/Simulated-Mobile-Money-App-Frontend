/**
 * Typed endpoint functions for the admin portal.
 * Operates purely client-side using the local simulation store.
 */

import { SimStore } from './store';
import type {
  FraudCase,
  AnalyticsSummary,
  CaseStatus,
} from '../types';

// ─── Admin Auth ─────────────────────────────────────────────────

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  analyst: {
    id: string;
    name: string;
    email: string;
    role: 'analyst' | 'senior_analyst' | 'admin';
  };
}

export async function adminLogin(payload: AdminLoginPayload): Promise<AdminLoginResponse> {
  const isKwame = payload.email?.toLowerCase().includes('kwame')
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

export interface CaseQueryParams {
  status?: CaseStatus;
  detectionType?: 'atod' | 'transaction_anomaly';
  riskLevel?: string;
  sortBy?: 'createdAt' | 'riskLevel' | 'amount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export async function getCases(params?: CaseQueryParams): Promise<FraudCase[]> {
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

export async function getCaseById(caseId: string): Promise<FraudCase> {
  const c = SimStore.get().getCaseById(caseId);
  if (!c) throw new Error(`Case ${caseId} not found`);
  return c;
}

export async function approveCase(caseId: string, note?: string): Promise<FraudCase> {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'approved' });
}

export async function blockCase(caseId: string, note?: string): Promise<FraudCase> {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'blocked' });
}

export async function escalateCase(caseId: string, note?: string): Promise<FraudCase> {
  const store = SimStore.get();
  if (note) {
    store.addCaseNote(caseId, 'Kwame Mensah', note);
  }
  return store.updateCase(caseId, { status: 'escalated' });
}

export async function addCaseNote(caseId: string, content: string): Promise<void> {
  SimStore.get().addCaseNote(caseId, 'Kwame Mensah', content);
}

// ─── Accounts ───────────────────────────────────────────────────

export async function freezeAccount(
  _accountId: string,
  _reason?: string
): Promise<{ success: boolean }> {
  return { success: true };
}

// ─── Analytics ──────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsSummary> {
  return SimStore.get().getAnalytics();
}
