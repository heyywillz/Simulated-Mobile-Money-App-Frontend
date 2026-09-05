/**
 * Biometric utilities for Swipe Pay:
 * - Browser WebAuthn integration (Touch ID, Windows Hello, Face ID, Android Biometrics)
 * - Synthesized audio feedback (Web Audio API)
 * - Camera stream acquisition & release
 * - Haptic vibration feedback
 */

// Synthesized audio feedback using Web Audio API
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playBiometricSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'scan') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'success') {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } else if (type === 'fail') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(160, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Gracefully ignore audio errors
  }
}

// Haptic feedback
export function triggerHaptic(type) {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(35);
        break;
      case 'success':
        navigator.vibrate([30, 40, 60]);
        break;
      case 'error':
        navigator.vibrate([60, 50, 60, 50, 80]);
        break;
    }
  } catch {
    // Ignore unsupported
  }
}

// Check if WebAuthn platform authenticator (TouchID / Windows Hello / Face ID) is supported
export async function isWebAuthnAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

// Perform WebAuthn biometric prompt (with safe fallback)
export async function requestWebAuthnBiometric(promptText = 'Authorize with Fingerprint / Face ID') {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    const challenge = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(challenge);
    }

    const userId = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(userId);
    }

    const options = {
      publicKey: {
        challenge,
        rp: {
          name: 'Swipe Pay Ghana',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userId,
          name: 'user@swipepay.gh',
          displayName: 'Swipe Pay User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    };

    const credential = await navigator.credentials.create(options);
    return !!credential;
  } catch (err) {
    return false;
  }
}

// Camera feed management with multi-tier progressive constraints
export async function requestUserMediaCamera() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    console.warn('[Camera] navigator.mediaDevices.getUserMedia not available in this environment');
    return null;
  }

  // Tier 1: User-facing with ideal resolution
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    return stream;
  } catch (err) {
    console.warn('[Camera] Tier 1 facingMode:user constraint failed, trying generic resolution:', err);
  }

  // Tier 2: Generic camera with ideal resolution
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    return stream;
  } catch (err) {
    console.warn('[Camera] Tier 2 generic resolution failed, trying minimal constraints:', err);
  }

  // Tier 3: Basic video: true (universal fallback)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    return stream;
  } catch (err) {
    console.warn('[Camera] Tier 3 basic video failed. No camera available or permission denied:', err);
    return null;
  }
}

/**
 * Safely attaches a MediaStream to an HTMLVideoElement and ensures playback begins.
 */
export async function attachStreamToVideo(video, stream) {
  if (!video || !stream) return false;

  try {
    video.srcObject = stream;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');

    if (video.readyState < 1) {
      await new Promise((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        setTimeout(resolve, 800);
      });
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      await playPromise.catch((err) => {
        console.warn('[Camera] video.play() warning:', err);
      });
    }

    return true;
  } catch (err) {
    console.error('[Camera] Failed to attach stream to video:', err);
    return false;
  }
}

export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch {
    // Ignore
  }
}
