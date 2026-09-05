import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import { formatCurrency } from '@momo/shared/src/constants'
import {
  DeviceMobileIcon,
  LocationPinIcon,
  CashInIcon,
  ZapIcon,
  FreezeIcon,
} from '@momo/shared/src/components/Icons'

const getSignalIcon = (type: string) => {
  switch (type) {
    case 'new_device':
      return <DeviceMobileIcon size={20} color="#8A0F13" />
    case 'new_location':
      return <LocationPinIcon size={20} color="#8A0F13" />
    case 'unusual_amount':
      return <CashInIcon size={20} color="#8A0F13" />
    case 'abnormal_frequency':
    default:
      return <ZapIcon size={20} color="#8A0F13" />
  }
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)
    if (id) loadCase()
  }, [id])

  const loadCase = async () => {
    try {
      const data = await adminApi.getCaseById(id!)
      setCaseData(data)
    } catch (err) {
      console.error('Failed to load case:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (action: 'approve' | 'block' | 'escalate') => {
    setActionLoading(action)
    try {
      const fn = action === 'approve' ? adminApi.approveCase
        : action === 'block' ? adminApi.blockCase
        : adminApi.escalateCase
      const updated = await fn(id!)
      setCaseData((prev: any) => ({ ...prev, ...updated }))
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      setActionLoading('')
    }
  }

  const handleFreeze = async () => {
    setActionLoading('freeze')
    try {
      await adminApi.freezeAccount(caseData.userId)
      setCaseData((prev: any) => ({ ...prev, userStatus: 'frozen' }))
    } catch (err) {
      console.error('Failed to freeze:', err)
    } finally {
      setActionLoading('')
    }
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    try {
      await adminApi.addCaseNote(id!, noteText)
      setNoteText('')
      loadCase()
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-neutral-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-white rounded-2xl animate-pulse" />
        <div className="h-48 bg-white rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="p-6 text-center">
        <p className="text-neutral-500">Case not found</p>
        <button onClick={() => navigate('/')} className="text-primary-800 text-sm font-semibold mt-2">
          Back to feed
        </button>
      </div>
    )
  }

  const riskStyles: Record<string, string> = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-neutral-200 text-neutral-800',
    high: 'bg-[#F2D5D6] text-[#8A0F13]',
    critical: 'bg-[#8A0F13] text-white',
  }

  const profile = caseData.userProfile
  const txn = caseData.transaction

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-900 font-mono">{caseData.id}</h1>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${riskStyles[caseData.riskLevel]}`}>
              {caseData.riskLevel.charAt(0).toUpperCase() + caseData.riskLevel.slice(1)} risk
            </span>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
              caseData.detectionType === 'atod' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'
            }`}>
              {caseData.detectionType === 'atod' ? 'Account takeover' : 'Transaction anomaly'}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">{caseData.userName} • {caseData.userPhone}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — main details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Behavior comparison — the key visual */}
          {profile && (
            <div className="bg-white rounded-2xl border border-neutral-100 p-5">
              <h3 className="text-sm font-bold text-neutral-900 mb-4">Behaviour comparison</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Usual */}
                <div className="p-4 bg-neutral-50 rounded-xl">
                  <p className="text-xs text-neutral-500 font-medium mb-2">Usual behaviour</p>
                  <p className="text-2xl font-black text-neutral-900">
                    {formatCurrency(profile.typicalTransactionRange[0])} – {formatCurrency(profile.typicalTransactionRange[1])}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Avg: {formatCurrency(profile.avgTransactionAmount)} • {profile.avgDailyTransactions}/day
                  </p>
                </div>
                {/* This transaction */}
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-xs text-[#8A0F13] font-medium mb-2">This transaction</p>
                  <p className="text-2xl font-black text-[#8A0F13]">
                    {formatCurrency(txn?.amount ?? 0)}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {((txn?.amount ?? 0) / profile.avgTransactionAmount).toFixed(1)}x the average
                  </p>
                </div>
              </div>

              {/* Visual bar */}
              <div className="mt-4 relative h-8 bg-neutral-100 rounded-full overflow-hidden">
                {/* Typical range */}
                <div
                  className="absolute top-0 h-full bg-neutral-300 rounded-full"
                  style={{
                    left: `${(profile.typicalTransactionRange[0] / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount)) * 100}%`,
                    width: `${((profile.typicalTransactionRange[1] - profile.typicalTransactionRange[0]) / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount)) * 100}%`,
                  }}
                />
                {/* This amount */}
                <div
                  className="absolute top-0 h-full w-1.5 bg-[#8A0F13] rounded-full"
                  style={{
                    left: `${Math.min(((txn?.amount ?? 0) / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount * 1.2)) * 100, 98)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                <span>GH₵ 0</span>
                <span className="text-neutral-600 font-medium">← Typical range →</span>
                <span>{formatCurrency(Math.max(txn?.amount ?? 0, profile.maxTransactionAmount))}</span>
              </div>
            </div>
          )}

          {/* Contributing signals */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-4">Contributing signals</h3>
            <div className="space-y-3">
              {caseData.signals?.map((signal: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    {getSignalIcon(signal.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-900">{signal.label}</p>
                      <span className="text-xs font-mono font-bold text-primary-800">
                        {(signal.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{signal.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction details */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Transaction details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-neutral-400">Type:</span> <span className="font-medium text-neutral-900">{txn?.type}</span></div>
              <div><span className="text-neutral-400">Amount:</span> <span className="font-bold text-neutral-900">{formatCurrency(txn?.amount ?? 0)}</span></div>
              <div><span className="text-neutral-400">Sender:</span> <span className="font-medium">{txn?.sender}</span></div>
              <div><span className="text-neutral-400">Receiver:</span> <span className="font-medium">{txn?.receiver}</span></div>
              <div><span className="text-neutral-400">Location:</span> <span className="font-medium">{txn?.location?.city}, {txn?.location?.region}</span></div>
              <div><span className="text-neutral-400">Status:</span> <span className="font-medium">{txn?.status}</span></div>
            </div>
          </div>
        </div>

        {/* Right column — actions & notes */}
        <div className="space-y-5">
          {/* Actions */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={!!actionLoading || caseData.status === 'approved'}
                className="w-full py-2.5 px-4 bg-green-50 text-green-800 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>{actionLoading === 'approve' ? 'Approving...' : 'Authorize Transaction'}</span>
              </button>
              <button
                onClick={() => handleAction('block')}
                disabled={!!actionLoading || caseData.status === 'blocked'}
                className="w-full py-2.5 px-4 bg-[#8A0F13] text-white rounded-xl text-xs font-bold hover:bg-primary-900 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{actionLoading === 'block' ? 'Blocking...' : 'Block & Mark Fraud'}</span>
              </button>
              <button
                onClick={() => handleAction('escalate')}
                disabled={!!actionLoading || caseData.status === 'escalated'}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>{actionLoading === 'escalate' ? 'Escalating...' : 'Escalate to Tier 2 Lead'}</span>
              </button>
              <button
                onClick={handleFreeze}
                disabled={!!actionLoading || caseData.userStatus === 'frozen'}
                className="w-full py-2.5 px-4 border border-neutral-200 text-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <FreezeIcon size={16} />
                <span>{actionLoading === 'freeze' ? 'Freezing...' : caseData.userStatus === 'frozen' ? 'Account frozen' : 'Freeze account'}</span>
              </button>
            </div>
          </div>

          {/* User profile */}
          {profile && (
            <div className="bg-white rounded-2xl border border-neutral-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                {caseData.userAvatar ? (
                  <img
                    src={caseData.userAvatar}
                    alt={caseData.userName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center font-bold text-sm">
                    {caseData.userName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{caseData.userName}</h3>
                  <p className="text-xs text-neutral-500">{caseData.userEmail || caseData.userPhone}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {caseData.userDob && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Date of birth</span>
                    <span className="font-medium">{caseData.userDob}</span>
                  </div>
                )}
                {caseData.userGender && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Gender</span>
                    <span className="font-medium capitalize">{caseData.userGender}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Account age</span>
                  <span className="font-medium">{profile.accountAge ?? '—'} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Biometric defense</span>
                  <span className="font-medium text-green-700 text-xs">
                    Face & Fingerprint Active ✓
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Known devices</span>
                  <span className="font-medium">{caseData.userDevices?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Known locations</span>
                  <span className="font-medium">{profile.knownLocations?.join(', ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Analyst notes */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Analyst notes</h3>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {caseData.analystNotes?.length === 0 ? (
                <p className="text-xs text-neutral-400">No notes yet</p>
              ) : (
                caseData.analystNotes?.map((note: any) => (
                  <div key={note.id} className="p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700">{note.author}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-neutral-600">{note.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-200"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
