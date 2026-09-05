import React, { useState, useCallback } from 'react'
import { ShieldCheckIcon } from '@momo/shared/src/components/Icons'

export default function PinPad({
  onComplete,
  length = 6,
  title = 'Enter your PIN',
  subtitle,
  error,
  isLoading = false,
  compact = false,
}) {
  const [pin, setPin] = useState('')
  const [shakeError, setShakeError] = useState(false)
  const [lastPressedKey, setLastPressedKey] = useState(null)

  const handlePress = useCallback(
    (digit) => {
      if (isLoading || pin.length >= length) return

      setLastPressedKey(digit)
      setTimeout(() => setLastPressedKey(null), 200)

      const newPin = pin + digit
      setPin(newPin)

      if (newPin.length === length) {
        setTimeout(() => onComplete(newPin), 150)
      }
    },
    [pin, length, onComplete, isLoading]
  )

  const handleDelete = useCallback(() => {
    if (isLoading) return
    setPin((prev) => prev.slice(0, -1))
  }, [isLoading])

  const handleClear = useCallback(() => {
    if (isLoading) return
    setPin('')
  }, [isLoading])

  // Trigger shake on error
  if (error && !shakeError) {
    setShakeError(true)
    setTimeout(() => {
      setShakeError(false)
      setPin('')
    }, 600)
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ]

  return (
    <div className={`flex flex-col items-center justify-center animate-fade-in ${compact ? 'px-2' : 'px-4'}`}>
      {/* Shield icon */}
      <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-2.5 shadow-sm">
        <ShieldCheckIcon size={24} color="#8A0F13" />
      </div>

      {/* Header */}
      <div className="text-center mb-2.5">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-0.5 leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-neutral-500 leading-tight">{subtitle}</p>
        )}
      </div>

      {/* PIN dots with ring animation */}
      <div
        className={`flex gap-3 mb-2.5 ${
          shakeError ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className="relative flex items-center justify-center"
          >
            {/* Outer ring on fill */}
            {i < pin.length && (
              <span className="absolute inset-[-4px] rounded-full border-2 border-primary-300/50 animate-ring-pulse" />
            )}
            <div
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-primary-800 scale-110 shadow-sm'
                  : 'bg-neutral-200 border border-neutral-300/50'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-primary-800 text-xs font-medium mb-2 animate-fade-in bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
          {error}
        </p>
      )}

      {/* Glassmorphic Keypad Container */}
      <div className="w-full max-w-[310px] sm:max-w-[320px] bg-white/75 backdrop-blur-lg rounded-3xl border border-neutral-200/60 p-3 sm:p-3.5 shadow-elevated">
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {keys.flat().map((key, idx) => {
            if (key === '') {
              return <div key={idx} />
            }

            if (key === 'del') {
              return (
                <button
                  key={idx}
                  onClick={handleDelete}
                  onDoubleClick={handleClear}
                  disabled={isLoading}
                  className="h-[54px] sm:h-[58px] rounded-2xl flex items-center justify-center
                             text-neutral-600 transition-all duration-150
                             hover:bg-neutral-100/80 active:bg-neutral-200 active:scale-95
                             disabled:opacity-30"
                  aria-label="Delete"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                  </svg>
                </button>
              )
            }

            return (
              <button
                key={idx}
                onClick={() => handlePress(key)}
                disabled={isLoading}
                className={`h-[54px] sm:h-[58px] rounded-2xl flex items-center justify-center
                           text-2xl font-semibold text-neutral-900
                           bg-neutral-50/90 border border-neutral-100
                           transition-all duration-150
                           hover:bg-neutral-100 active:bg-neutral-200 active:scale-95
                           disabled:opacity-30
                           ${lastPressedKey === key ? 'animate-bounce-scale' : ''}`}
              >
                {key}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="mt-2.5 flex items-center gap-2 text-neutral-500 text-xs animate-pulse-soft bg-white px-3 py-1.5 rounded-xl border border-neutral-100 shadow-xs">
          <div className="w-3.5 h-3.5 border-2 border-primary-200 border-t-primary-800 rounded-full animate-spin" />
          <span className="font-medium">Verifying identity...</span>
        </div>
      )}
    </div>
  )
}
