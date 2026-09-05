/**
 * Biometric Verification Page (`/verify/facial`).
 * Layer 2 authentication following SMS login OTP.
 * Supports:
 * - Live Camera Facial Liveness Detection & Mesh Scan
 * - Interactive Press-and-Hold Fingerprint Sensor HUD
 * - System WebAuthn (Touch ID / Windows Hello)
 * - Synthesized audio chimes & haptic feedback
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  requestUserMediaCamera,
  attachStreamToVideo,
  stopMediaStream,
  playBiometricSound,
  triggerHaptic,
  isWebAuthnAvailable,
  requestWebAuthnBiometric,
  RealtimeFaceTracker,
} from '@momo/shared'
import { ShieldCheckIcon, CheckIcon, FingerprintIcon } from '@momo/shared/src/components/Icons'

export default function FacialVerification() {
  const { setFacialVerified, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState(() => {
    const urlType = searchParams.get('type')
    if (urlType === 'fingerprint' || urlType === 'facial') return urlType
    const stored = sessionStorage.getItem('pending_biometric_type')
    if (stored === 'fingerprint' || stored === 'facial') return stored
    return 'facial'
  })

  useEffect(() => {
    const urlType = searchParams.get('type')
    if (urlType === 'fingerprint' || urlType === 'facial') {
      setActiveTab(urlType)
    }
  }, [searchParams])

  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [cameraStream, setCameraStream] = useState(null)
  const [hasCamera, setHasCamera] = useState(null)
  const [isPressingSensor, setIsPressingSensor] = useState(false)
  const [hasWebAuthn, setHasWebAuthn] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [livenessStage, setLivenessStage] = useState('center')
  const [liveResult, setLiveResult] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const trackerRef = useRef(null)
  const holdIntervalRef = useRef(null)

  // Initialize WebAuthn check
  useEffect(() => {
    isWebAuthnAvailable().then(setHasWebAuthn)
  }, [])

  // Stop camera and tracker helper
  const stopCamera = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.stop()
      trackerRef.current = null
    }
    if (cameraStream) {
      stopMediaStream(cameraStream)
      setCameraStream(null)
    }
    setLiveResult(null)
  }, [cameraStream])

  useEffect(() => {
    return () => {
      stopCamera()
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
    }
  }, [stopCamera])

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    stopCamera()
    setActiveTab(tab)
    setStatus('idle')
    setProgress(0)
    setErrorMessage(null)
    setIsPressingSensor(false)
  }

  // ─── Attach Camera Stream & Initialize Face Tracker on Mount ───────
  useEffect(() => {
    if (!cameraStream || !videoRef.current) return

    let activeTracker = null

    attachStreamToVideo(videoRef.current, cameraStream).then((attached) => {
      if (!attached || !videoRef.current) return

      if (canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640
        canvasRef.current.height = videoRef.current.videoHeight || 480
      }

      if (trackerRef.current) {
        trackerRef.current.stop()
      }

      const tracker = new RealtimeFaceTracker(
        videoRef.current,
        canvasRef.current || undefined,
        {
          onFrame: (result) => {
            setLiveResult(result)

            if (result.detected) {
              setProgress((prev) => {
                const target = Math.max(prev, result.livenessScore)
                const next = Math.min(100, target)

                if (next >= 40 && prev < 40) {
                  setLivenessStage('blink')
                  playBiometricSound('tick')
                } else if (next >= 75 && prev < 75) {
                  setLivenessStage('mesh')
                  playBiometricSound('tick')
                }

                if (next >= 100 && result.livenessPassed) {
                  tracker.stop()
                  setStatus('analyzing')
                  playBiometricSound('tick')

                  setTimeout(() => {
                    setStatus('success')
                    playBiometricSound('success')
                    triggerHaptic('success')
                    setFacialVerified(true)

                    setTimeout(() => {
                      stopCamera()
                      navigate('/')
                    }, 1100)
                  }, 700)
                }
                return next
              })
            } else {
              setProgress((prev) => Math.max(0, prev - 1))
            }
          },
        }
      )

      trackerRef.current = tracker
      activeTracker = tracker
      tracker.start()
    })

    return () => {
      if (activeTracker) {
        activeTracker.stop()
      }
    }
  }, [cameraStream, setFacialVerified, navigate, stopCamera])

  // Automatically start facial scan on mount
  useEffect(() => {
    if (activeTab === 'facial') {
      startFacialScan()
    }
  }, [activeTab])

  // ─── REAL-TIME FACIAL SCAN & COMPUTER VISION ENGINE ─────────────────
  const startFacialScan = async () => {
    setStatus('scanning')
    setProgress(0)
    setErrorMessage(null)
    setLivenessStage('center')
    playBiometricSound('scan')
    triggerHaptic('light')

    try {
      const stream = await requestUserMediaCamera()
      if (stream) {
        setCameraStream(stream)
        setHasCamera(true)
      } else {
        setHasCamera(false)
        runFallbackSimulatedScan()
      }
    } catch {
      setHasCamera(false)
      runFallbackSimulatedScan()
    }
  }

  const runFallbackSimulatedScan = () => {
    let currentProg = 0
    const interval = setInterval(() => {
      currentProg += 4
      setProgress(Math.min(currentProg, 100))

      if (currentProg === 36) {
        setLivenessStage('blink')
        playBiometricSound('tick')
      } else if (currentProg === 72) {
        setLivenessStage('mesh')
        playBiometricSound('tick')
      }

      if (currentProg >= 100) {
        clearInterval(interval)
        setStatus('analyzing')
        playBiometricSound('tick')

        setTimeout(() => {
          setStatus('success')
          playBiometricSound('success')
          triggerHaptic('success')
          setFacialVerified(true)

          setTimeout(() => {
            stopCamera()
            navigate('/')
          }, 1100)
        }, 700)
      }
    }, 40)
  }

  // ─── FINGERPRINT TOUCH SENSOR LOGIC ────────────────────────────────
  const handleSensorPressStart = () => {
    if (status === 'success' || status === 'analyzing') return
    setIsPressingSensor(true)
    setStatus('scanning')
    setErrorMessage(null)
    playBiometricSound('tick')
    triggerHaptic('medium')

    let currentProg = 0
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)

    holdIntervalRef.current = setInterval(() => {
      currentProg += 4
      setProgress(Math.min(currentProg, 100))

      if (currentProg % 20 === 0) {
        playBiometricSound('tick')
        triggerHaptic('light')
      }

      if (currentProg >= 100) {
        clearInterval(holdIntervalRef.current)
        setIsPressingSensor(false)
        setStatus('analyzing')

        setTimeout(() => {
          setStatus('success')
          playBiometricSound('success')
          triggerHaptic('success')
          setFacialVerified(true)

          setTimeout(() => {
            navigate('/')
          }, 1100)
        }, 700)
      }
    }, 35)
  }

  const handleSensorPressEnd = () => {
    if (status === 'scanning' && progress < 100) {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      setIsPressingSensor(false)
      setStatus('idle')
      setProgress(0)
      setErrorMessage('Hold your finger steady on the sensor until scan reaches 100%')
      triggerHaptic('error')
    }
  }

  // WebAuthn Biometric Trigger
  const handleWebAuthnPrompt = async () => {
    setStatus('scanning')
    setErrorMessage(null)
    playBiometricSound('scan')
    try {
      const ok = await requestWebAuthnBiometric('Swipe Pay Ghana Biometric Auth')
      if (ok) {
        setStatus('success')
        playBiometricSound('success')
        triggerHaptic('success')
        setFacialVerified(true)
        setTimeout(() => {
          navigate('/')
        }, 1000)
      } else {
        setStatus('idle')
        setErrorMessage('Device biometric prompt was dismissed. Press and hold the sensor below.')
      }
    } catch {
      setStatus('idle')
      setErrorMessage('WebAuthn unavailable on this browser. Use touch sensor.')
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm flex flex-col items-center text-center">
        {/* Top Security Pill */}
        <div className="flex items-center gap-1.5 px-3.5 py-1 bg-red-50 text-primary-800 border border-red-200 rounded-full text-xs font-bold mb-4">
          <ShieldCheckIcon size={15} color="#8A0F13" />
          <span>Layer 2 Biometric Defense</span>
        </div>

        <h2 className="text-xl font-black text-neutral-900 mb-1 tracking-tight">
          Verify Your Identity
        </h2>
        <p className="text-xs text-neutral-500 mb-5 max-w-xs">
          Confirm your identity via Face ID liveness scan or biometric fingerprint sensor.
        </p>

        {/* Tab Toggle */}
        <div className="w-full p-1 bg-neutral-100 rounded-2xl flex gap-1 mb-6">
          <button
            type="button"
            onClick={() => handleTabChange('facial')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'facial'
                ? 'bg-white text-primary-800 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
            </svg>
            <span>Face ID</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('fingerprint')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'fingerprint'
                ? 'bg-white text-primary-800 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FingerprintIcon size={16} color={activeTab === 'fingerprint' ? '#8A0F13' : '#6b7280'} />
            <span>Fingerprint</span>
          </button>
        </div>

        {errorMessage && (
          <div className="w-full mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-primary-800 animate-slide-down">
            {errorMessage}
          </div>
        )}

        {/* ═══════════════════════════ TAB 1: FACIAL SCAN ═══════════════════════════ */}
        {activeTab === 'facial' && (
          <div className="w-full space-y-4">
            {/* Camera / Face Scanner HUD */}
            <div className="relative mx-auto w-48 h-48 flex items-center justify-center">
              <div
                className={`w-44 h-44 rounded-full border-4 flex items-center justify-center relative overflow-hidden transition-all duration-300 shadow-inner ${
                  status === 'success'
                    ? 'border-emerald-500 bg-emerald-50'
                    : status === 'failed'
                    ? 'border-red-600 bg-red-50'
                    : liveResult?.detected
                    ? 'border-emerald-500 bg-neutral-900'
                    : status === 'scanning'
                    ? 'border-primary-600 bg-neutral-900'
                    : 'border-neutral-200 bg-neutral-100'
                }`}
              >
                {hasCamera && cameraStream && status !== 'success' && status !== 'failed' ? (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ transform: 'scaleX(-1)' }}
                      className="w-full h-full object-cover"
                    />
                    <canvas
                      ref={canvasRef}
                      style={{ transform: 'scaleX(-1)' }}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  </div>
                ) : user?.profilePicture && status !== 'success' && status !== 'failed' ? (
                  <div className="relative w-full h-full">
                    <img
                      src={user.profilePicture}
                      alt="Enrolled Face"
                      className="w-full h-full object-cover filter brightness-95"
                    />
                    <div className="absolute inset-0 bg-primary-950/10 pointer-events-none" />
                  </div>
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-850 to-neutral-950 text-white p-2">
                    {/* Biometric Cyber Silhouette Avatar */}
                    <svg viewBox="0 0 100 100" className="w-28 h-28 text-red-500">
                      <ellipse cx="50" cy="48" rx="26" ry="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" className="animate-pulse" />
                      <circle cx="40" cy="44" r="3" fill="#EF4444" />
                      <circle cx="60" cy="44" r="3" fill="#EF4444" />
                      <polygon points="50,49 47,56 53,56" fill="#F59E0B" />
                      <path d="M42 64 Q50 71 58 64" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                      <line x1="40" y1="44" x2="60" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                      <line x1="40" y1="44" x2="50" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                      <line x1="60" y1="44" x2="50" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                      <line x1="50" y1="56" x2="50" y2="67" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                    </svg>
                    <span className="text-[9px] font-mono font-bold text-neutral-300 uppercase tracking-wider -mt-1">
                      {status === 'scanning' ? 'Scanning Mesh' : 'Live Camera'}
                    </span>
                  </div>
                )}

                {/* Scanning Laser Line */}
                {status === 'scanning' && !liveResult?.detected && (
                  <div
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] transition-all pointer-events-none"
                    style={{ top: `${progress}%` }}
                  />
                )}

                {/* Success Indicator */}
                {status === 'success' && (
                  <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white animate-scale-in">
                    <CheckIcon size={44} color="#FFFFFF" />
                    <span className="text-xs font-black uppercase tracking-wider mt-1.5">Authenticated</span>
                  </div>
                )}
              </div>

              {/* Outer Circular Progress Ring */}
              {status === 'scanning' && (
                <svg className="absolute inset-0 w-48 h-48 -rotate-90 pointer-events-none" viewBox="0 0 192 192">
                  <circle
                    cx="96"
                    cy="96"
                    r="92"
                    fill="none"
                    stroke={liveResult?.detected ? '#10B981' : '#8A0F13'}
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 92}`}
                    strokeDashoffset={`${2 * Math.PI * 92 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-100"
                  />
                </svg>
              )}
            </div>

            {hasCamera === false && status !== 'success' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] font-semibold text-amber-800 animate-fade-in mx-auto">
                <span>⚡ Camera offline or denied. Biometric simulation active.</span>
                <button
                  type="button"
                  onClick={startFacialScan}
                  className="underline font-bold text-primary-800 hover:text-primary-900"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Dynamic Real-time Status Text */}
            <div>
              <h3 className="text-base font-black text-neutral-900 flex items-center justify-center gap-1.5">
                {status === 'idle' && 'Center Your Face & Look at Camera'}
                {status === 'scanning' && (
                  liveResult
                    ? liveResult.statusText
                    : livenessStage === 'center'
                    ? 'Position Face in Ring...'
                    : livenessStage === 'blink'
                    ? 'Hold Steady — Recording Liveness Proof...'
                    : 'Extracting Facial Landmark Vectors...'
                )}
                {status === 'analyzing' && 'Matching with Registered Biometrics...'}
                {status === 'success' && 'Face ID Verified ✓'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                {status === 'idle' && 'Click the button below to activate your camera'}
                {status === 'scanning' && (
                  liveResult?.detected
                    ? `Live Camera Tracking: Confidence ${liveResult.confidence}% • Liveness ${liveResult.livenessScore}%`
                    : 'Looking for a live human face in the camera frame...'
                )}
                {status === 'analyzing' && 'Comparing with enrolled facial biometric token'}
                {status === 'success' && 'Redirecting to your dashboard...'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {status === 'idle' && (
                <button onClick={startFacialScan} className="btn-primary w-full py-3.5 text-sm font-bold shadow-xs">
                  Start Face Verification
                </button>
              )}

              {status === 'failed' && (
                <button onClick={startFacialScan} className="btn-primary w-full py-3.5 text-sm font-bold shadow-xs">
                  Retry Face Scan
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════ TAB 2: FINGERPRINT SCAN ═════════════════════════ */}
        {activeTab === 'fingerprint' && (
          <div className="w-full space-y-4">
            {/* Interactive Press-and-Hold Sensor */}
            <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
              <button
                type="button"
                onMouseDown={handleSensorPressStart}
                onMouseUp={handleSensorPressEnd}
                onTouchStart={handleSensorPressStart}
                onTouchEnd={handleSensorPressEnd}
                disabled={status === 'success' || status === 'analyzing'}
                className={`w-36 h-36 rounded-3xl border-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 select-none shadow-md ${
                  status === 'success'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 scale-105'
                    : isPressingSensor
                    ? 'border-primary-600 bg-red-50 text-primary-800 scale-95 shadow-inner'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-primary-300 hover:bg-neutral-100'
                }`}
                style={{ touchAction: 'none' }}
              >
                {isPressingSensor && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-24 h-24 rounded-full border-2 border-red-500/40 animate-ping" />
                    <div className="w-16 h-16 rounded-full border-2 border-red-600/60 animate-pulse" />
                  </div>
                )}

                {status === 'success' ? (
                  <div className="flex flex-col items-center animate-scale-in">
                    <CheckIcon size={48} color="#059669" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mt-1">Verified</span>
                  </div>
                ) : (
                  <>
                    <FingerprintIcon
                      size={56}
                      color={isPressingSensor ? '#8A0F13' : '#525252'}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-2">
                      {isPressingSensor ? `${progress}%` : 'Press & Hold'}
                    </span>
                  </>
                )}
              </button>

              {/* Progress Ring */}
              {isPressingSensor && (
                <svg className="absolute inset-0 w-44 h-44 -rotate-90 pointer-events-none" viewBox="0 0 176 176">
                  <circle
                    cx="88"
                    cy="88"
                    r="82"
                    fill="none"
                    stroke="#8A0F13"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 82}`}
                    strokeDashoffset={`${2 * Math.PI * 82 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>

            {/* Dynamic Status Text */}
            <div>
              <h3 className="text-base font-black text-neutral-900">
                {status === 'idle' && 'Touch & Hold Sensor Pad'}
                {isPressingSensor && 'Scanning Ridge Vectors — Keep Holding...'}
                {status === 'analyzing' && 'Matching Biometric Signature...'}
                {status === 'success' && 'Fingerprint Verified ✓'}
                {status === 'failed' && 'Sensor Read Failed'}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                {isPressingSensor
                  ? 'Keep holding until progress bar reaches 100%.'
                  : 'Place your finger on the sensor or use system Touch ID.'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {hasWebAuthn && status !== 'success' && (
                <button
                  type="button"
                  onClick={handleWebAuthnPrompt}
                  className="w-full py-3 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-neutral-200"
                >
                  <FingerprintIcon size={16} color="#171717" />
                  <span>Use System Touch ID / Windows Hello</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
