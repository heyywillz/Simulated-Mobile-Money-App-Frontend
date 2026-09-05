/**
 * Login page — Multi-factor authentication interface with:
 * - Email Address
 * - Ghana Card Number
 * - Secret Password
 * - Choice between Facial Liveness Scan OR Fingerprint Biometrics
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import swipePayLogo from '../assets/swipe-pay-logo.png'
import {
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
  FingerprintIcon,
  FaceScanIcon,
} from '@momo/shared/src/components/Icons'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  // Form State
  const [email, setEmail] = useState('')
  const [ghanaCard, setGhanaCard] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [biometricType, setBiometricType] = useState('facial')

  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your account email address')
      return
    }
    if (!ghanaCard.trim()) {
      setError('Please enter your Ghana Card number (e.g. GHA-000000000-0)')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }

    setIsLoading(true)

    sessionStorage.setItem('pending_biometric_type', biometricType)

    const result = await login({
      email: email.trim(),
      ghanaCard: ghanaCard.trim(),
      password,
      biometricType,
    })

    setIsLoading(false)

    if (result.success) {
      // Proceed to the selected biometric verification layer
      if (biometricType === 'facial') {
        navigate('/verify/facial?type=facial')
      } else {
        navigate('/verify/facial?type=fingerprint')
      }
    } else {
      setError(result.error ?? 'Invalid email, Ghana Card, or password.')
    }
  }

  return (
    <div className="h-screen min-h-[90vh] max-h-screen bg-[#F5F5F7] flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden">
      <div className="w-full max-w-4xl h-[92vh] min-h-[90vh] max-h-[96vh] bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Brand & Security Showcase */}
        <div className="lg:col-span-5 bg-primary-800 text-white p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden hidden sm:flex">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <img
                src={swipePayLogo}
                alt="Swipe Pay"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none">Swipe Pay</h1>
                <p className="text-[10px] text-red-200 font-medium tracking-wider uppercase mt-0.5">
                  Mobile Money Ghana
                </p>
              </div>
            </div>

            <div className="space-y-2.5 my-4">
              <h2 className="text-xl font-black tracking-tight leading-snug">
                AI-Protected Financial Gateway
              </h2>
              <p className="text-xs text-red-100 leading-relaxed">
                Protected by National Identity verification, dual biometric keys (Facial Liveness or Fingerprint), and automated fraud defenses.
              </p>
            </div>

            {/* Value Props */}
            <div className="space-y-2.5 pt-3.5 border-t border-white/15 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon size={15} color="#86efac" />
                <span>Ghana Card & Password Security</span>
              </div>
              <div className="flex items-center gap-2">
                <FaceScanIcon size={15} color="#fde047" />
                <span>Optical Face Liveness Scan</span>
              </div>
              <div className="flex items-center gap-2">
                <FingerprintIcon size={15} color="#ffffff" />
                <span>Hardware Fingerprint Sensor HUD</span>
              </div>
              <div className="flex items-center gap-2">
                <ZapIcon size={15} color="#93c5fd" />
                <span>Zero-Latency Real-Time Telemetry</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/15 text-[10px] text-white/70">
            Regulated Mobile Money Platform • 256-bit SSL Protection
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="col-span-1 lg:col-span-7 h-full p-4 sm:p-6 lg:p-8 flex flex-col justify-center relative overflow-y-auto">
          <div className="animate-fade-in space-y-3.5 max-w-md mx-auto w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                Sign In to Wallet
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Authenticate with your email, Ghana Card, password, and biometric key.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                  Account Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder="e.g. name@momo.gh or gmail.com"
                  className="input-field py-2 px-3 text-sm font-medium"
                  required
                />
              </div>

              {/* Ghana Card ID */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                  Ghana Card Number
                </label>
                <input
                  type="text"
                  value={ghanaCard}
                  onChange={(e) => { setGhanaCard(e.target.value); setError(null) }}
                  placeholder="GHA-XXXXXXXXX-X"
                  className="input-field py-2 px-3 text-sm font-mono font-bold uppercase tracking-wider"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                  Account Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null) }}
                    placeholder="Enter your secret password"
                    className="input-field pr-10 py-2 px-3 text-sm font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 hover:text-neutral-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Biometric Verification Selection */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                  Choose Biometric Verification
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBiometricType('facial')}
                    className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      biometricType === 'facial'
                        ? 'border-primary-800 bg-red-50/70 ring-2 ring-primary-800/20'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        biometricType === 'facial' ? 'bg-primary-800 text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      <FaceScanIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900 leading-tight">Facial Scan</p>
                      <p className="text-[10px] text-neutral-500">Live Camera</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBiometricType('fingerprint')}
                    className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                      biometricType === 'fingerprint'
                        ? 'border-primary-800 bg-red-50/70 ring-2 ring-primary-800/20'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        biometricType === 'fingerprint' ? 'bg-primary-800 text-white' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      <FingerprintIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-900 leading-tight">Fingerprint</p>
                      <p className="text-[10px] text-neutral-500">Touch Sensor</p>
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-primary-800 text-xs font-semibold bg-red-50 p-2 rounded-xl border border-red-100">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 text-sm font-bold shadow-xs flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>
                    Proceed to {biometricType === 'facial' ? 'Facial Scan' : 'Fingerprint'} →
                  </span>
                )}
              </button>
            </form>

            <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[10px] text-neutral-600 flex items-start gap-1.5 leading-relaxed">
              <ShieldCheckIcon size={14} className="text-primary-800 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Trust Protocol:</strong> Passwords authorize identity; your chosen biometric key authorizes your active session.
              </span>
            </div>

            <div className="text-center pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500">
                Don't have an account?{' '}
                <Link to="/onboarding" className="text-primary-800 font-bold hover:underline">
                  Create a Wallet
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
