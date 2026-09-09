import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import { formatCurrency } from '@momo/shared/src/constants'
import { createAdminSocket } from '@momo/shared/src/socket/client'
import { ShieldAlertIcon, ZapIcon, DeviceMobileIcon } from '@momo/shared/src/components/Icons'

export default function LiveFeed() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)
    loadCases()

    if (token) {
      const socket = createAdminSocket(token)

      socket.on('admin:case:new', (newCase) => {
        setCases((prev) => {
          const exists = prev.some((c) => c.id === newCase.id)
          if (exists) return prev
          return [newCase, ...prev]
        })
      })

      socket.on('admin:case:updated', (updatedCase) => {
        setCases((prev) =>
          prev.map((c) => (c.id === updatedCase.id ? { ...c, ...updatedCase } : c))
        )
      })

      return () => {
        socket.disconnect()
      }
    }
  }, [])

  const loadCases = async () => {
    try {
      const data = await adminApi.getCases()
      setCases(data)
    } catch (err) {
      console.error('Failed to load cases:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (filterType !== 'all' && c.detectionType !== filterType) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesUser = c.userName.toLowerCase().includes(q) || c.userPhone.includes(q)
        const matchesId = c.id.toLowerCase().includes(q)
        if (!matchesUser && !matchesId) return false
      }
      return true
    })
  }, [cases, filterStatus, filterType, searchQuery])

  // Summary Metrics
  const stats = useMemo(() => {
    const open = cases.filter((c) => c.status === 'open' || c.status === 'under_review').length
    const critical = cases.filter((c) => c.riskLevel === 'critical').length
    const atod = cases.filter((c) => c.detectionType === 'atod').length
    const scores = cases.map((c) => c.transaction?.mlScore).filter((s) => typeof s === 'number')
    const avgMlScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { open, critical, atod, total: cases.length, avgMlScore }
  }, [cases])

  const getMlScoreColor = (score) => {
    if (score >= 0.8) return 'text-[#8A0F13] bg-[#F2D5D6] font-black'
    if (score >= 0.6) return 'text-orange-700 bg-orange-50 font-bold'
    if (score >= 0.3) return 'text-amber-700 bg-amber-50 font-semibold'
    return 'text-emerald-700 bg-emerald-50 font-medium'
  }

  const statusStyles = {
    open: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
    under_review: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
    approved: 'bg-neutral-100 text-neutral-700',
    blocked: 'bg-[#8A0F13] text-white',
    escalated: 'bg-neutral-900 text-white',
  }

  const riskStyles = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-neutral-200 text-neutral-800',
    high: 'bg-[#F2D5D6] text-[#8A0F13] font-bold',
    critical: 'bg-[#8A0F13] text-white font-bold',
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffHrs = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHrs < 1) return 'Just now'
    if (diffHrs < 24) return `${diffHrs}h ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Live Fraud Queue</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Real-time Account Takeover & Transaction Anomaly monitoring stream
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto px-3.5 py-1.5 bg-white rounded-full border border-neutral-200 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs font-semibold text-neutral-700 font-mono">LIVE FEED SYNC</span>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">Open Cases</span>
            <span className="w-2 h-2 rounded-full bg-primary-800" />
          </div>
          <p className="text-2xl font-black text-neutral-900">{stats.open}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Requiring review</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">Critical Risk</span>
            <ShieldAlertIcon size={16} color="#8A0F13" />
          </div>
          <p className="text-2xl font-black text-[#8A0F13]">{stats.critical}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Immediate action</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">ATOD Flagged</span>
            <DeviceMobileIcon size={16} color="#171717" />
          </div>
          <p className="text-2xl font-black text-neutral-900">{stats.atod}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Account takeover</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">Total Flagged</span>
            <ZapIcon size={16} color="#737373" />
          </div>
          <p className="text-2xl font-black text-neutral-900">{stats.total}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">All time records</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500">Avg ML Score</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
              <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
            </svg>
          </div>
          <p className="text-2xl font-black text-[#8A0F13]">
            {stats.avgMlScore !== null ? (stats.avgMlScore * 100).toFixed(0) + '%' : '—'}
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Fraud probability</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by User, Phone number, or Case ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:bg-white transition-all"
          />
        </div>

        <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="blocked">Blocked</option>
            <option value="escalated">Escalated</option>
            <option value="approved">Approved</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">All Detection Types</option>
            <option value="atod">Account Takeover (ATOD)</option>
            <option value="transaction_anomaly">Transaction Anomaly</option>
          </select>
        </div>
      </div>

      {/* Cases table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[700px]">
              <thead>
                <tr className="bg-neutral-50/70">
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Case ID</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Customer</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Detection Model</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Amount</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">ML Score</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Risk Level</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Case Status</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="cursor-pointer hover:bg-neutral-50/80 transition-colors animate-fade-in"
                    style={{ animationDelay: `${idx * 25}ms` }}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-lg">
                        {c.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-neutral-900 text-sm">{c.userName}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">{c.userPhone}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 ${
                          c.detectionType === 'atod' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {c.detectionType === 'atod' ? 'Account takeover' : 'Transaction anomaly'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-neutral-900 text-sm">
                      {formatCurrency(c.transaction?.amount ?? 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      {typeof c.transaction?.mlScore === 'number' ? (
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 font-mono ${getMlScoreColor(c.transaction.mlScore)}`}>
                          {c.transaction.mlScore >= 0.8 && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                          {(c.transaction.mlScore * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5 ${riskStyles[c.riskLevel]}`}>
                        {c.riskLevel === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />}
                        {c.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5 ${statusStyles[c.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {(c.status === 'open' || c.status === 'under_review') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                        )}
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-neutral-400 text-right whitespace-nowrap">
                      {formatTime(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-neutral-500 font-medium text-sm">No cases match your filters or search query</p>
              <p className="text-neutral-400 text-xs mt-1">Try resetting filters to view incoming transactions</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
