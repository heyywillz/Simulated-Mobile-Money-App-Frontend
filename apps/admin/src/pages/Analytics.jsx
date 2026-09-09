import { useState, useEffect } from 'react'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

import { createAdminSocket } from '@momo/shared/src/socket/client'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)
    loadAnalytics()

    if (token) {
      const socket = createAdminSocket(token)
      socket.on('admin:stats:updated', (updatedStats) => {
        setData((prev) => ({ ...prev, ...updatedStats }))
      })
      return () => {
        socket.disconnect()
      }
    }
  }, [])

  const loadAnalytics = async () => {
    try {
      const analytics = await adminApi.getAnalytics()
      setData(analytics)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-neutral-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-white rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  const pieData = [
    { name: 'Account takeover', value: data.detectionSplit.atod, color: '#171717' },
    { name: 'Transaction anomaly', value: data.detectionSplit.transactionAnomaly, color: '#8A0F13' },
  ]

  const riskStyles = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-neutral-200 text-neutral-800',
    high: 'bg-[#F2D5D6] text-[#8A0F13]',
    critical: 'bg-[#8A0F13] text-white',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Fraud Analytics & Metrics</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">Aggregated statistics, detection distributions, and account risk history</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total transactions</p>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{data.totalTransactions.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-400 mt-1">System processed</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total flagged</p>
          <p className="text-2xl sm:text-3xl font-black text-[#8A0F13]">{data.totalFlagged}</p>
          <p className="text-[11px] text-primary-800 font-semibold mt-1">{data.flagRate}% overall flag rate</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total blocked</p>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{data.totalBlocked}</p>
          <p className="text-[11px] text-neutral-400 mt-1">High-confidence defense</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Approved post-review</p>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{data.totalApproved}</p>
          <p className="text-[11px] text-green-700 font-medium mt-1">Analyst authorized</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
              <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
            </svg>
            <p className="text-xs text-neutral-500 font-medium">ML Model Accuracy</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{data.mlModelAccuracy}%</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">fraud_detection_v1</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Avg ML Score</p>
          <p className="text-2xl sm:text-3xl font-black text-[#8A0F13]">{(data.avgMlScore * 100).toFixed(0)}%</p>
          <p className="text-[11px] text-neutral-400 mt-1">Across flagged txns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flags over time */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Flags over time (30 days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.flagsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#A3A3A3' }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10, fill: '#A3A3A3' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                />
                <Bar dataKey="count" fill="#8A0F13" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detection type split */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Detection model split</h3>
          <div className="h-64 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ value }) => `${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs font-semibold mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neutral-900" />
              <span>ATOD ({data.detectionSplit.atod})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#8A0F13]" />
              <span>Anomaly ({data.detectionSplit.transactionAnomaly})</span>
            </div>
          </div>
        </div>

        {/* ML Score Distribution */}
        {data.mlScoreDistribution && (
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-xs lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
                <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
              </svg>
              <h3 className="text-sm font-bold text-neutral-900">ML Score Distribution</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mlScoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="bracket" tick={{ fontSize: 11, fill: '#737373' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#A3A3A3' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                    formatter={(value, name) => [value, 'Transactions']}
                    labelFormatter={(label) => `Score range: ${label}`}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.mlScoreDistribution.map((entry, idx) => {
                      const colors = ['#059669', '#b45309', '#c2410c', '#8A0F13']
                      return <Cell key={idx} fill={colors[idx]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-[11px] font-semibold mt-3 pt-3 border-t border-neutral-100">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Low</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Medium</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-700" /> High</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8A0F13]" /> Critical</div>
            </div>
          </div>
        )}
      </div>

      {/* Top flagged accounts */}
      <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900 mb-4">Top flagged customer accounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[600px]">
            <thead>
              <tr className="bg-neutral-50/70">
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500">Customer Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500">Phone Number</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500">Flag Count</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500">Last Incident</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-right">Risk Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {data.topFlaggedAccounts.map((account) => (
                <tr key={account.userId} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-neutral-900">{account.userName}</td>
                  <td className="py-3.5 px-4 font-mono text-neutral-600 text-xs">{account.phoneNumber}</td>
                  <td className="py-3.5 px-4 font-black text-neutral-900">{account.flagCount}</td>
                  <td className="py-3.5 px-4 text-neutral-500 text-xs">{new Date(account.lastFlaggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${riskStyles[account.riskLevel]}`}>
                      {account.riskLevel.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
