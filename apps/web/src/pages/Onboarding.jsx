/**
 * Onboarding — Multi-step wallet creation & biometric KYC onboarding flow.
 * Steps:
 * 1. Personal Information (Full Name, Email, DOB, Gender)
 * 2. Profile Picture Upload (File upload, camera snapshot, avatar presets)
 * 3. Mobile Number & Ghana Card ID (KYC Tier 2)
 * 4. Biometric Defense Enrollment (Facial Scan Liveness + Biometric Fingerprint)
 * 5. Create & Confirm 6-Digit MoMo PIN / Password
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useSubmit } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PinPad from '../components/PinPad';
import swipePayLogo from '../assets/swipe-pay-logo.png';
import {
  requestUserMediaCamera,
  attachStreamToVideo,
  stopMediaStream,
  playBiometricSound,
  triggerHaptic,
  isWebAuthnAvailable,
  requestWebAuthnBiometric,
  RealtimeFaceTracker,
  api,
} from '@momo/shared';
import {
  ShieldCheckIcon,
  CheckIcon,
  FingerprintIcon,
  FaceScanIcon,
  MailIcon,
  CalendarIcon,
  UserIcon,
  CameraIcon,
  UploadIcon,
  SparklesIcon,
} from '@momo/shared/src/components/Icons';
import axios from 'axios';

const STEP_METADATA = {
  personal: {
    title: 'Personal Details',
    subtitle: 'Name, email, date of birth & gender',
    stage: 1,
  },
  photo: {
    title: 'Upload Profile Photo',
    subtitle: 'Upload an official photo or take a live camera snapshot',
    stage: 2,
  },
  kyc: {
    title: 'Mobile & Ghana Card',
    subtitle: 'Primary wallet number & National ID',
    stage: 3,
  },
  facial: {
    title: 'Facial Liveness Scan',
    subtitle: 'Biometric mesh & identity verification',
    stage: 4,
  },
  fingerprint: {
    title: 'Fingerprint Biometrics',
    subtitle: 'Hardware biometric key enrollment',
    stage: 4,
  },
  password: {
    title: 'Create Account Password',
    subtitle: 'Set a secure secret password to protect your wallet account',
    stage: 5,
  },
  success: {
    title: 'Wallet Created',
    subtitle: 'Your account is active & ready',
    stage: 6,
  },
};

export default function Onboarding() {
  const { signup, setFacialVerified } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [step, setStep] = useState('personal');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('1998-05-14');
  const [gender, setGender] = useState('male');
  const [profilePicture, setProfilePicture] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ghanaCardId, setGhanaCardId] = useState('GHA-');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 2 Live Camera Snapshot State
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [photoCameraStream, setPhotoCameraStream] = useState(null);
  const photoVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Biometric Facial Scan State
  const [faceScanState, setFaceScanState] = useState('idle');
  const [faceProgress, setFaceProgress] = useState(0);
  const [cameraStream, setCameraStream] = useState(null);
  const [hasCamera, setHasCamera] = useState(null);
  const [liveFaceResult, setLiveFaceResult] = useState(null);

  const videoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const faceTrackerRef = useRef(null);

  // Biometric Fingerprint State
  const [fpState, setFpState] = useState('idle');
  const [fpProgress, setFpProgress] = useState(0);
  const [isPressingFpSensor, setIsPressingFpSensor] = useState(false);
  const [fpHoldError, setFpHoldError] = useState(null);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const fpHoldIntervalRef = useRef(null);

  const currentStageIndex = STEP_METADATA[step]?.stage ?? 1;

  // Cleanup camera streams on unmount
  const stopCamera = () => {
    if (faceTrackerRef.current) {
      faceTrackerRef.current.stop();
      faceTrackerRef.current = null;
    }
    if (cameraStream) {
      stopMediaStream(cameraStream);
      setCameraStream(null);
    }
    setLiveFaceResult(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (photoCameraStream) stopMediaStream(photoCameraStream);
      if (fpHoldIntervalRef.current) clearInterval(fpHoldIntervalRef.current);
    };
  }, [cameraStream, photoCameraStream]);

  // Check hardware availability
  useEffect(() => {
    isWebAuthnAvailable()
      .then(setHasWebAuthn)
      .catch(() => setHasWebAuthn(false));
  }, []);

  // Auto-attach photo snapshot stream to video element when ready
  useEffect(() => {
    if (isTakingPhoto && photoCameraStream && photoVideoRef.current) {
      attachStreamToVideo(photoVideoRef.current, photoCameraStream);
    }
  }, [isTakingPhoto, photoCameraStream]);

  // Handle Photo Camera Snapshots
  const startPhotoCamera = async () => {
    setError(null);
    try {
      const stream = await requestUserMediaCamera();
      if (stream) {
        setPhotoCameraStream(stream);
        setIsTakingPhoto(true);
      } else {
        setError(
          'Camera unavailable or permission denied. Please upload a photo file instead.',
        );
        setIsTakingPhoto(false);
      }
    } catch {
      setError('Could not access camera for profile photo.');
      setIsTakingPhoto(false);
    }
  };

  const stopPhotoCamera = () => {
    if (photoCameraStream) {
      stopMediaStream(photoCameraStream);
      setPhotoCameraStream(null);
    }
    setIsTakingPhoto(false);
  };

  const handleCaptureSnapshot = () => {
    if (!photoVideoRef.current) return;
    const video = photoVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 400;
    canvas.height = video.videoHeight || 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Un-mirror when capturing official photo
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setProfilePicture(dataUrl);
      playBiometricSound('success');
    }
    stopPhotoCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setProfilePicture(event.target.result);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-attach live facial scan stream and start CV tracker when camera is active
  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;

    let activeTracker = null;

    attachStreamToVideo(videoRef.current, cameraStream).then((attached) => {
      if (!attached || !videoRef.current) return;

      if (faceCanvasRef.current) {
        faceCanvasRef.current.width = videoRef.current.videoWidth || 640;
        faceCanvasRef.current.height = videoRef.current.videoHeight || 480;
      }

      if (faceTrackerRef.current) {
        faceTrackerRef.current.stop();
      }

      const tracker = new RealtimeFaceTracker(
        videoRef.current,
        faceCanvasRef.current || undefined,
        {
          onFrame: (result) => {
            setLiveFaceResult(result);
            if (result.detected) {
              setFaceProgress((prev) =>
                Math.min(100, Math.max(prev, result.livenessScore)),
              );
              if (result.livenessPassed) {
                tracker.stop();
                setFaceScanState('analyzing');
                setTimeout(() => {
                  setFaceScanState('passed');
                  playBiometricSound('success');
                  triggerHaptic('success');
                  setFacialVerified(true);
                  stopCamera();
                }, 800);
              }
            }
          },
        },
      );

      faceTrackerRef.current = tracker;
      activeTracker = tracker;
      tracker.start();
    });

    return () => {
      if (activeTracker) {
        activeTracker.stop();
      }
    };
  }, [cameraStream]);

  // Handle Facial Verification Scanner
  const startFacialScan = async () => {
    setError(null);
    setFaceScanState('scanning');
    setFaceProgress(0);
    playBiometricSound('scan');
    triggerHaptic('light');

    try {
      const stream = await requestUserMediaCamera();
      if (stream) {
        setCameraStream(stream);
        setHasCamera(true);
      } else {
        setHasCamera(false);
        runFallbackSimulatedScan();
      }
    } catch {
      setHasCamera(false);
      runFallbackSimulatedScan();
    }
  };

  const runFallbackSimulatedScan = () => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 15;
      setFaceProgress(Math.min(currentProgress, 90));
      if (currentProgress >= 90) {
        clearInterval(interval);
        setFaceScanState('analyzing');
        setTimeout(() => {
          setFaceProgress(100);
          setFaceScanState('passed');
          playBiometricSound('success');
          triggerHaptic('success');
          setFacialVerified(true);
        }, 800);
      }
    }, 250);
  };

  // Fingerprint Press & Hold
  const handleFpPressStart = () => {
    if (fpState === 'passed') return;
    setIsPressingFpSensor(true);
    setFpState('scanning');
    setFpHoldError(null);
    playBiometricSound('tick');
    triggerHaptic('medium');

    let current = 0;
    if (fpHoldIntervalRef.current) clearInterval(fpHoldIntervalRef.current);

    fpHoldIntervalRef.current = setInterval(() => {
      current += 5;
      setFpProgress(Math.min(current, 100));
      if (current >= 100) {
        clearInterval(fpHoldIntervalRef.current);
        setIsPressingFpSensor(false);
        setFpState('passed');
        playBiometricSound('success');
        triggerHaptic('success');
      }
    }, 40);
  };

  const handleFpPressEnd = () => {
    if (fpState === 'scanning' && fpProgress < 100) {
      if (fpHoldIntervalRef.current) clearInterval(fpHoldIntervalRef.current);
      setIsPressingFpSensor(false);
      setFpState('idle');
      setFpProgress(0);
      setFpHoldError('Hold your finger steady until enrollment completes');
      triggerHaptic('error');
    }
  };

  const handleWebAuthnEnroll = async () => {
    setFpState('scanning');
    setFpHoldError(null);
    playBiometricSound('scan');
    try {
      const ok = await requestWebAuthnBiometric(
        'Swipe Pay Ghana Fingerprint Enrollment',
      );
      if (ok) {
        setFpState('passed');
        setFpProgress(100);
        playBiometricSound('success');
        triggerHaptic('success');
      } else {
        setFpState('idle');
        setFpHoldError(
          'Biometric prompt dismissed. Use the touch sensor below.',
        );
      }
    } catch {
      setFpState('idle');
    }
  };

  // Navigation handlers
  const handlePersonalContinue = () => {
    setError(null);
    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      setError('Please enter your full legal name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setStep('photo');
  };

  const handlePhotoContinue = () => {
    if (!profilePicture) {
      setError('Please upload or snap a profile photo to proceed');
      return;
    }
    setError(null);
    stopPhotoCamera();
    setStep('kyc');
  };

  const handleKycContinue = () => {
    setError(null);
    if (phoneNumber.trim().length < 9) {
      setError('Please enter a valid Ghana mobile number');
      return;
    }
    if (!ghanaCardId.startsWith('GHA-') || ghanaCardId.length < 12) {
      setError('Please enter your Ghana Card ID (e.g. GHA-123456789-0)');
      return;
    }
    setStep('facial');
  };

  // Biometric Template Hashes
  const [facialTemplate, setFacialTemplate] = useState('');
  const [fingerprintTemplate, setFingerprintTemplate] = useState('');

  const handleFacialContinue = () => {
    if (!facialTemplate) {
      setFacialTemplate(
        `BIO-FACE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      );
    }
    setStep('fingerprint');
  };

  const handleFingerprintContinue = () => {
    if (!fingerprintTemplate) {
      setFingerprintTemplate(
        `BIO-FP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      );
    }
    setStep('password');
  };

  const submit = useSubmit();

  const handlePasswordSubmit = async (e) => {
    // if (e) e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const finalFaceTmpl =
      facialTemplate ||
      `BIO-FACE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const finalFpTmpl =
      fingerprintTemplate ||
      `BIO-FP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      // const result = await signup({
      //   fullName: fullName.trim(),
      //   phoneNumber: phoneNumber.trim(),
      //   email: email.trim(),
      //   password,
      //   pin: password,
      //   dob,
      //   gender,
      //   profilePicture,
      //   facialScanVerified: faceScanState === 'passed',
      //   facialTemplate: finalFaceTmpl,
      //   biometricFingerprintEnrolled: fpState === 'passed',
      //   fingerprintTemplate: finalFpTmpl,
      //   ghanaCardId: ghanaCardId.trim(),
      // });

      // submit all inputs

      console.log(
        'this inputs',
        `${{
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim(),
          password,
          pin: password,
          dob,
          gender,
          profilePicture,
          facialScanVerified: faceScanState === 'passed',
          facialTemplate: finalFaceTmpl,
          biometricFingerprintEnrolled: fpState === 'passed',
          fingerprintTemplate: finalFpTmpl,
          ghanaCardId: ghanaCardId.trim(),
        }}`,
      );
      submit(
        {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim(),
          password,
          pin: password,
          dob,
          gender,
          profilePicture,
          facialScanVerified: faceScanState === 'passed',
          facialTemplate: finalFaceTmpl,
          biometricFingerprintEnrolled: fpState === 'passed',
          fingerprintTemplate: finalFpTmpl,
          ghanaCard: ghanaCardId.trim(),
        },
        { method: 'POST' },
      );

      setIsLoading(false);

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error ?? 'Account creation failed. Please try again.');
      }
    } catch (err) {
      setIsLoading(false);
      setError(err?.message ?? 'Account creation failed. Please try again.');
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        {/* Left Side: Brand & Visual Overview */}
        <div className="lg:col-span-5 bg-primary-800 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-950/40 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <img
                src={swipePayLogo}
                alt="Swipe Pay"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-xl font-black tracking-tight leading-none">
                  Swipe Pay
                </h1>
                <p className="text-[11px] text-red-200 font-medium tracking-wider uppercase mt-1">
                  Wallet Creation & KYC
                </p>
              </div>
            </div>

            <div className="space-y-3 my-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-bold text-red-100">
                <ShieldCheckIcon size={14} color="#fca5a5" />
                Verified KYC Onboarding
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                {STEP_METADATA[step]?.title}
              </h2>
              <p className="text-xs text-red-100/80 leading-relaxed">
                {STEP_METADATA[step]?.subtitle}
              </p>
            </div>

            {/* Stepper Progress */}
            <div className="space-y-2.5 pt-6 border-t border-white/15">
              {[
                { stage: 1, label: 'Personal Information' },
                { stage: 2, label: 'Profile Picture' },
                { stage: 3, label: 'Ghana Card & Mobile' },
                { stage: 4, label: 'Biometrics (Face & Touch)' },
                { stage: 5, label: 'Security MoMo PIN' },
              ].map((s) => {
                const isPassed =
                  currentStageIndex > s.stage || step === 'success';
                const isCurrent =
                  currentStageIndex === s.stage && step !== 'success';
                return (
                  <div
                    key={s.stage}
                    className="flex items-center gap-3 text-xs"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] transition-all duration-300 ${
                        isPassed
                          ? 'bg-white text-primary-800 shadow-xs'
                          : isCurrent
                            ? 'bg-white/25 text-white border border-white scale-105'
                            : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {isPassed ? '✓' : s.stage}
                    </div>
                    <span
                      className={`transition-colors ${isCurrent ? 'font-bold text-white' : isPassed ? 'text-white/80' : 'text-white/40'}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Step Forms */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-6 animate-fade-in">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-primary-800 text-xs font-semibold rounded-xl text-center">
                {error}
              </div>
            )}

            {/* ─── STEP 1: Personal Details ───────────────────────────── */}
            {step === 'personal' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                    Personal Details
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Please enter your accurate personal information for account
                    KYC.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                    Legal Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <UserIcon size={18} />
                    </span>
                    <input
                      type="text"
                      name="fullName"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setError(null);
                      }}
                      placeholder="e.g. Kwame Mensah"
                      className="input-field pl-10 text-sm font-semibold"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <MailIcon size={18} />
                    </span>
                    <input
                      type="email"
                      value={email}
                      name="email"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="kwame.mensah@gmail.com"
                      className="input-field pl-10 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                        <CalendarIcon size={16} />
                      </span>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="input-field pl-10 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                      Gender
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 h-[42px] p-1 bg-neutral-100 rounded-xl">
                      {['male', 'female', 'other'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`rounded-lg text-xs font-bold capitalize transition-all ${
                            gender === g
                              ? 'bg-white text-neutral-900 shadow-xs'
                              : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePersonalContinue}
                  className="btn-primary w-full py-3.5 text-sm font-bold mt-2"
                >
                  Continue to Profile Photo →
                </button>
              </div>
            )}

            {/* ─── STEP 2: Profile Picture Upload ─────────────────────── */}
            {step === 'photo' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                    Upload Profile Photo
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Upload a real, clear portrait photo of yourself or take a
                    live camera snapshot. This photo is required for KYC
                    compliance and Face ID cross-comparison.
                  </p>
                </div>

                {/* Photo Upload & Live Camera Zone */}
                <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-200 flex flex-col items-center justify-center text-center space-y-4">
                  {isTakingPhoto ? (
                    <div className="w-full max-w-xs space-y-3">
                      <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden border-4 border-primary-700 bg-black shadow-lg">
                        <video
                          ref={photoVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={handleCaptureSnapshot}
                          className="btn-primary py-2 px-4 text-xs font-bold shadow-xs flex items-center gap-1.5"
                        >
                          <CameraIcon size={14} color="#FFFFFF" />
                          <span>Capture Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            stopPhotoCamera();
                            setIsTakingPhoto(false);
                          }}
                          className="btn-secondary py-2 px-3 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : profilePicture ? (
                    <div className="flex flex-col items-center space-y-3">
                      <div className="relative">
                        <img
                          src={profilePicture}
                          alt="Official Profile Preview"
                          className="w-28 h-28 rounded-full object-cover border-4 border-primary-800 shadow-md"
                        />
                        <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[9px] font-bold shadow-xs">
                          Photo Loaded ✓
                        </span>
                      </div>
                      <p className="text-xs font-bold text-neutral-800">
                        Official Profile Photo Attached
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <UploadIcon size={13} />
                          <span>Replace File</span>
                        </button>
                        <button
                          type="button"
                          onClick={startPhotoCamera}
                          className="px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <CameraIcon size={13} />
                          <span>Retake with Camera</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 space-y-3">
                      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 text-primary-800 flex items-center justify-center mx-auto shadow-2xs">
                        <UserIcon size={32} color="#8A0F13" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-800">
                          No profile photo uploaded yet
                        </p>
                        <p className="text-xs text-neutral-500 max-w-xs mx-auto mt-0.5">
                          Please upload an image file from your device or take a
                          live picture using your camera.
                        </p>
                      </div>
                      <div className="flex gap-2.5 justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                        >
                          <UploadIcon size={14} color="#FFFFFF" />
                          <span>Upload Photo File</span>
                        </button>
                        <button
                          type="button"
                          onClick={startPhotoCamera}
                          className="btn-secondary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 border-neutral-300 hover:bg-neutral-100"
                        >
                          <CameraIcon size={14} color="#8A0F13" />
                          <span>Take Live Photo</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      stopPhotoCamera();
                      setIsTakingPhoto(false);
                      setStep('personal');
                    }}
                    className="btn-secondary flex-1 py-3 text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handlePhotoContinue}
                    disabled={!profilePicture}
                    className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all shadow-xs ${
                      profilePicture
                        ? 'btn-primary bg-primary-800 text-white'
                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    Continue to KYC →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3: Phone & Ghana Card KYC ─────────────────────── */}
            {step === 'kyc' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                    Ghana Card & Phone
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Required for Mobile Money authorization and ATOD protection.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                    Ghana Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 text-xs font-bold">
                      🇬🇭 +233
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      name="phoneNumber"
                      onChange={(e) => {
                        setPhoneNumber(e.target.value);
                        setError(null);
                      }}
                      placeholder="024 123 4567"
                      className="input-field pl-20 text-sm font-bold font-mono"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                    Ghana Card ID KYC Number
                  </label>
                  <input
                    type="text"
                    value={ghanaCardId}
                    name="ghanaCardId"
                    onChange={(e) => {
                      setGhanaCardId(e.target.value);
                      setError(null);
                    }}
                    placeholder="GHA-723491823-4"
                    className="input-field text-sm font-bold font-mono uppercase"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Format: GHA-XXXXXXXXX-X
                  </p>
                </div>

                <div className="p-3 bg-red-50/70 rounded-2xl border border-red-100 flex items-start gap-2.5">
                  <ShieldCheckIcon size={18} color="#8A0F13" />
                  <p className="text-[11px] text-primary-900 leading-snug">
                    Ghana Card credentials enable instant transactions up to GH₵
                    20,000 daily limit.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('photo')}
                    className="btn-secondary flex-1 py-3 text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleKycContinue}
                    className="btn-primary flex-1 py-3 text-sm font-bold"
                  >
                    Continue to Biometrics →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 4A: Facial Liveness Scan ──────────────────────── */}
            {step === 'facial' && (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-primary-800 border border-red-200 rounded-full text-xs font-bold">
                  <FaceScanIcon size={14} color="#8A0F13" />
                  <span>Biometric Layer 1: Live Facial Scan</span>
                </div>

                <h3 className="text-xl font-black text-neutral-900 tracking-tight">
                  {faceScanState === 'idle' && 'Facial Liveness Verification'}
                  {faceScanState === 'scanning' &&
                    'Hold Still — Scanning Face...'}
                  {faceScanState === 'analyzing' &&
                    'Matching Facial Mesh Landmark Tokens...'}
                  {faceScanState === 'passed' &&
                    'Facial Verification Confirmed!'}
                </h3>

                {/* Face Scanner Circle HUD */}
                <div className="relative mx-auto w-48 h-48 my-2 flex items-center justify-center">
                  <div
                    className={`w-44 h-44 rounded-full border-4 flex items-center justify-center relative overflow-hidden transition-all duration-300 shadow-inner ${
                      faceScanState === 'passed'
                        ? 'border-green-500 bg-green-50'
                        : liveFaceResult?.detected
                          ? 'border-green-500 bg-neutral-900'
                          : faceScanState === 'scanning'
                            ? 'border-primary-500 bg-neutral-900'
                            : 'border-neutral-200 bg-neutral-100'
                    }`}
                  >
                    {hasCamera && cameraStream && faceScanState !== 'passed' ? (
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
                          ref={faceCanvasRef}
                          style={{ transform: 'scaleX(-1)' }}
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                      </div>
                    ) : profilePicture && faceScanState !== 'passed' ? (
                      <div className="relative w-full h-full">
                        <img
                          src={profilePicture}
                          alt="Face Scan"
                          className="w-full h-full object-cover filter brightness-95"
                        />
                        <div className="absolute inset-0 bg-primary-950/10 pointer-events-none" />
                      </div>
                    ) : (
                      <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-neutral-850 to-neutral-950 text-white p-2">
                        {/* Biometric Cyber Silhouette Avatar */}
                        <svg
                          viewBox="0 0 100 100"
                          className="w-28 h-28 text-red-500"
                        >
                          <ellipse
                            cx="50"
                            cy="48"
                            rx="26"
                            ry="34"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeDasharray="3 3"
                            className="animate-pulse"
                          />
                          <circle cx="40" cy="44" r="3" fill="#EF4444" />
                          <circle cx="60" cy="44" r="3" fill="#EF4444" />
                          <polygon points="50,49 47,56 53,56" fill="#F59E0B" />
                          <path
                            d="M42 64 Q50 71 58 64"
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <line
                            x1="40"
                            y1="44"
                            x2="60"
                            y2="44"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.8"
                          />
                          <line
                            x1="40"
                            y1="44"
                            x2="50"
                            y2="56"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.8"
                          />
                          <line
                            x1="60"
                            y1="44"
                            x2="50"
                            y2="56"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.8"
                          />
                          <line
                            x1="50"
                            y1="56"
                            x2="50"
                            y2="67"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.8"
                          />
                        </svg>
                        <span className="text-[9px] font-mono font-bold text-neutral-300 uppercase tracking-wider -mt-1">
                          {faceScanState === 'scanning'
                            ? 'Scanning Mesh'
                            : 'Live Camera'}
                        </span>
                      </div>
                    )}

                    {/* Animated Scanning Laser Line */}
                    {faceScanState === 'scanning' &&
                      !liveFaceResult?.detected && (
                        <div
                          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] transition-all pointer-events-none"
                          style={{ top: `${faceProgress}%` }}
                        />
                      )}

                    {/* Success Check Badge */}
                    {faceScanState === 'passed' && (
                      <div className="absolute inset-0 bg-green-500/90 flex flex-col items-center justify-center text-white animate-scale-in">
                        <CheckIcon size={40} color="#FFFFFF" />
                        <span className="text-xs font-black uppercase mt-1">
                          Verified
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Circular Progress Ring */}
                  {faceScanState === 'scanning' && (
                    <svg
                      className="absolute inset-0 w-48 h-48 -rotate-90 pointer-events-none"
                      viewBox="0 0 192 192"
                    >
                      <circle
                        cx="96"
                        cy="96"
                        r="92"
                        fill="none"
                        stroke={
                          liveFaceResult?.detected ? '#10B981' : '#8A0F13'
                        }
                        strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 92}`}
                        strokeDashoffset={`${2 * Math.PI * 92 * (1 - faceProgress / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-100"
                      />
                    </svg>
                  )}
                </div>

                {hasCamera === false && faceScanState !== 'passed' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] font-semibold text-amber-800 animate-fade-in">
                    <span>
                      ⚡ Camera offline or denied. Simulation mode active.
                    </span>
                    <button
                      type="button"
                      onClick={startFacialScan}
                      className="underline font-bold text-primary-800 hover:text-primary-900"
                    >
                      Retry Camera
                    </button>
                  </div>
                )}

                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  {faceScanState === 'idle' &&
                    'AI-assisted face matching binds your physical biometric token to your new wallet.'}
                  {faceScanState === 'scanning' &&
                    (liveFaceResult?.detected
                      ? `Tracking: Confidence ${liveFaceResult.confidence}% | Liveness ${liveFaceResult.livenessScore}%`
                      : 'Looking for a live human face in the camera frame...')}
                  {faceScanState === 'analyzing' &&
                    'Cross-referencing biometric mesh with Ghana Card registry...'}
                  {faceScanState === 'passed' &&
                    'Biometric face signature successfully verified & tokenized.'}
                </p>

                {faceScanState === 'idle' && (
                  <button
                    type="button"
                    onClick={startFacialScan}
                    className="btn-primary w-full py-3.5 text-sm font-bold shadow-xs"
                  >
                    Start Live Face Scan
                  </button>
                )}

                {faceScanState === 'passed' && (
                  <button
                    type="button"
                    onClick={handleFacialContinue}
                    className="btn-primary w-full py-3.5 text-sm font-bold bg-green-700 hover:bg-green-800"
                  >
                    Continue to Fingerprint Enrollment →
                  </button>
                )}
              </div>
            )}

            {/* ─── STEP 4B: Biometric Fingerprint ─────────────────────── */}
            {step === 'fingerprint' && (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-primary-800 border border-red-200 rounded-full text-xs font-bold">
                  <FingerprintIcon size={14} color="#8A0F13" />
                  <span>Biometric Layer 2: Touch Sensor Enrollment</span>
                </div>

                <h3 className="text-xl font-black text-neutral-900 tracking-tight">
                  {fpState === 'idle' && 'Enroll Biometric Fingerprint'}
                  {isPressingFpSensor &&
                    'Recording Ridge Pattern — Keep Holding...'}
                  {fpState === 'passed' && 'Fingerprint Enrolled Successfully!'}
                </h3>

                {fpHoldError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-primary-800">
                    {fpHoldError}
                  </div>
                )}

                {/* Fingerprint Touch Sensor HUD */}
                <div className="relative mx-auto w-44 h-44 my-2 flex items-center justify-center">
                  <button
                    type="button"
                    onMouseDown={handleFpPressStart}
                    onMouseUp={handleFpPressEnd}
                    onTouchStart={handleFpPressStart}
                    onTouchEnd={handleFpPressEnd}
                    disabled={fpState === 'passed'}
                    className={`w-36 h-36 rounded-3xl border-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 select-none shadow-md ${
                      fpState === 'passed'
                        ? 'border-green-500 bg-green-50 text-green-700 scale-105'
                        : isPressingFpSensor
                          ? 'border-primary-600 bg-red-50 text-primary-800 scale-95 shadow-inner'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-primary-300'
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    {isPressingFpSensor && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-24 h-24 rounded-full border-2 border-red-500/40 animate-ping" />
                        <div className="w-16 h-16 rounded-full border-2 border-red-600/60 animate-pulse" />
                      </div>
                    )}

                    <FingerprintIcon
                      size={56}
                      color={
                        fpState === 'passed'
                          ? '#16a34a'
                          : isPressingFpSensor
                            ? '#8A0F13'
                            : '#525252'
                      }
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-2">
                      {fpState === 'idle' && 'Press & Hold'}
                      {isPressingFpSensor && `${fpProgress}%`}
                      {fpState === 'passed' && 'Enrolled ✓'}
                    </span>
                  </button>

                  {/* Circular Progress Ring on Hold */}
                  {isPressingFpSensor && (
                    <svg
                      className="absolute inset-0 w-44 h-44 -rotate-90 pointer-events-none"
                      viewBox="0 0 176 176"
                    >
                      <circle
                        cx="88"
                        cy="88"
                        r="82"
                        fill="none"
                        stroke="#8A0F13"
                        strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 82}`}
                        strokeDashoffset={`${2 * Math.PI * 82 * (1 - fpProgress / 100)}`}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>

                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  {fpState === 'idle' &&
                    'Press and hold the sensor to bind your fingerprint for one-tap transaction approvals.'}
                  {isPressingFpSensor &&
                    'Hold finger steady until enrollment progress completes...'}
                  {fpState === 'passed' &&
                    'Hardware biometric key generated and securely stored.'}
                </p>

                {hasWebAuthn && fpState !== 'passed' && (
                  <button
                    type="button"
                    onClick={handleWebAuthnEnroll}
                    className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-neutral-200"
                  >
                    <FingerprintIcon size={16} color="#171717" />
                    <span>Use System Touch ID / Windows Hello</span>
                  </button>
                )}

                {fpState === 'passed' && (
                  <button
                    type="button"
                    onClick={handleFingerprintContinue}
                    className="btn-primary w-full py-3.5 text-sm font-bold bg-green-700 hover:bg-green-800"
                  >
                    Continue to Set Password →
                  </button>
                )}
              </div>
            )}

            {/* ─── STEP 5: Create & Confirm Account Password ────────────── */}
            {step === 'password' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
                    Create Account Password
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Set a secure password for your Swipe Pay account login.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        name="password"
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="At least 6 characters"
                        className="input-field pr-10 py-3 text-sm font-medium"
                        autoFocus
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

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1 uppercase tracking-wide">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="Re-enter password"
                        className="input-field pr-10 py-3 text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 hover:text-neutral-700"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {/* Password Checklist */}
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-[11px] space-y-1.5">
                    <div
                      className={`flex items-center gap-1.5 ${password.length >= 6 ? 'text-green-700 font-bold' : 'text-neutral-400'}`}
                    >
                      <span>{password.length >= 6 ? '✓' : '○'}</span>
                      <span>At least 6 characters</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 ${password && password === confirmPassword ? 'text-green-700 font-bold' : 'text-neutral-400'}`}
                    >
                      <span>
                        {password && password === confirmPassword ? '✓' : '○'}
                      </span>
                      <span>Passwords match</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-primary-800 text-xs font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={
                    password.length < 6 ||
                    password !== confirmPassword ||
                    isLoading
                  }
                  className="btn-primary w-full py-3.5 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Complete Account Creation →</span>
                  )}
                </button>
              </div>
            )}

            {/* ─── STEP 7: Success & Activation ──────────────────────── */}
            {step === 'success' && (
              <div className="space-y-5 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 mx-auto flex items-center justify-center animate-scale-in">
                  <CheckIcon size={36} color="#15803d" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                    Wallet Account Ready!
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    Welcome to Swipe Pay. Your mobile money wallet has been
                    activated.
                  </p>
                </div>

                {/* Account Summary Card */}
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={profilePicture}
                      alt={fullName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary-800"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900">
                        {fullName}
                      </h4>
                      <p className="text-xs text-neutral-500 font-mono">
                        {phoneNumber}
                      </p>
                      <p className="text-[11px] text-neutral-400">{email}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-200/60 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded-xl border border-neutral-100">
                      <span className="text-neutral-400 block font-bold uppercase text-[9px]">
                        Starting Balance
                      </span>
                      <span className="text-sm font-black text-primary-800 font-mono">
                        GH₵ 5,000.00
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-neutral-100">
                      <span className="text-neutral-400 block font-bold uppercase text-[9px]">
                        KYC Status
                      </span>
                      <span className="text-sm font-bold text-green-700">
                        Verified
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-green-700 font-bold bg-green-50 p-2 rounded-xl border border-green-200">
                    <ShieldCheckIcon size={14} color="#15803d" />
                    <span>
                      Facial Liveness & Fingerprint Biometric Protection
                      Enrolled
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  // onClick={() => navigate('/')}
                  className="btn-primary w-full py-3.5 text-sm font-bold shadow-md"
                >
                  Go to Wallet Dashboard →
                </button>
              </div>
            )}

            {step !== 'success' && (
              <div className="text-center pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-500">
                  Already have a wallet?{' '}
                  <Link
                    to="/login"
                    className="text-primary-800 font-bold hover:underline"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function action({ request, params } = {}) {
  console.log('start collecting the request');
  const formData = await request.formData();
  const formEntries = Object.fromEntries(formData.entries());
  // {"email": "aninakwa31q1@gmail.com", "fullName": "Aninakwa Desmond", "ghanaCard": "GHA-123456789-3", "password": "@mista223", "device":"nokia 23", "location":{"lat":4.333, "long":-2.222}}

  const { email, fullName, ghanaCard, password } = formEntries;
  console.log('entries', {
    email,
    fullName,
    ghanaCard,
    password,
    device: 'nokia 23',
    location: { lat: 4.333, long: -2.222 },
  });
  // 'https://machine-learning-server-ohnz.onrender.com',
  try {
    const response = await axios.post(
      'http://localhost:5000/',

      {
        email,
        fullName,
        ghanaCard,
        password,
        device: 'nokia 23',
        location: { lat: 4.333, long: -2.222 },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },

      // { "C"},
    );

    // const response = await axios.post(
    // 'https://machine-learning-server-ohnz.onrender.com',
    // {
    //   email,
    //   fullName,
    //   ghanaCard,
    //   password,
    //   device: 'nokia 23',
    //   location: {
    //     lat: 4.333,
    //     long: -2.222,
    //   },
    // },
    // {
    //   withCredentials: true,
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    // }

    console.log('response', response);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}
