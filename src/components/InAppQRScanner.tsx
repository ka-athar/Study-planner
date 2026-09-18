import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { 
  Camera, 
  CameraOff, 
  FlipHorizontal, 
  Flashlight, 
  FlashlightOff, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Smartphone, 
  KeyRound, 
  ArrowRight, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText,
  Sparkles,
  Archive,
  BookOpen
} from 'lucide-react';

export interface ParsedQRResult {
  raw: string;
  type: 'transfer_pin' | 'study_url' | 'vault_bundle' | 'email_link' | 'generic_url' | 'text';
  transferPin?: string;
  syncEmail?: string;
  syncUid?: string;
  action?: string;
  data?: any;
  displayText: string;
}

interface InAppQRScannerProps {
  onScanResult: (result: ParsedQRResult) => void;
  onClose?: () => void;
  autoExecuteTransfer?: boolean;
}

export const parseQRData = (rawText: string): ParsedQRResult => {
  const trimmed = rawText.trim();

  // 1. Check if it's a 6-digit numeric PIN
  if (/^\d{6}$/.test(trimmed)) {
    return {
      raw: trimmed,
      type: 'transfer_pin',
      transferPin: trimmed,
      displayText: `Transfer PIN: ${trimmed}`
    };
  }

  // 2. Check if JSON payload (e.g. Vault Bundle or Syllabus Data)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.studyVault || parsed.vault || parsed.type === 'STUDY_VAULT_BUNDLE') {
        return {
          raw: trimmed,
          type: 'vault_bundle',
          data: parsed,
          displayText: `Study Vault Bundle: "${parsed.vault?.name || parsed.studyVault?.name || 'Academic Vault'}"`
        };
      }
      return {
        raw: trimmed,
        type: 'vault_bundle',
        data: parsed,
        displayText: `Structured Study JSON (${Object.keys(parsed).length} keys)`
      };
    } catch (e) {}
  }

  // 3. Check if it's a StudyOS URL with query params
  if (trimmed.includes('transfer_code=') || trimmed.includes('connect_code=') || trimmed.includes('link_pin=') || trimmed.includes('pin=')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://studyos.local/${trimmed}`);
      const pin = url.searchParams.get('transfer_code') || 
                  url.searchParams.get('connect_code') || 
                  url.searchParams.get('link_pin') || 
                  url.searchParams.get('pin');
      const email = url.searchParams.get('sync_email') || url.searchParams.get('email');
      const uid = url.searchParams.get('sync_uid') || url.searchParams.get('uid');
      const action = url.searchParams.get('action');

      if (pin) {
        return {
          raw: trimmed,
          type: 'transfer_pin',
          transferPin: pin.replace(/[^0-9]/g, ''),
          syncEmail: email || undefined,
          syncUid: uid || undefined,
          action: action || undefined,
          displayText: `Device Link QR (${pin}) ${email ? `• ${email}` : ''}`
        };
      }
    } catch (e) {}
  }

  // 4. Check for actionable email / task link
  if (trimmed.includes('action=') || trimmed.includes('completed_task=true')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://studyos.local/${trimmed}`);
      const action = url.searchParams.get('action');
      const topic = url.searchParams.get('topic') || url.searchParams.get('topicName');
      return {
        raw: trimmed,
        type: 'study_url',
        action: action || 'complete_task',
        displayText: `Study Action: ${action || 'Complete Task'} ${topic ? `("${topic}")` : ''}`
      };
    } catch (e) {}
  }

  // 5. Standard Web URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      raw: trimmed,
      type: 'generic_url',
      displayText: trimmed
    };
  }

  // 6. Generic Text
  return {
    raw: trimmed,
    type: 'text',
    displayText: trimmed
  };
};

export const InAppQRScanner: React.FC<InAppQRScannerProps> = ({
  onScanResult,
  onClose,
  autoExecuteTransfer = true
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<ParsedQRResult | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Sound feedback on successful scan
  const playBeepSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);

      // Vibration if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 60]);
      }
    } catch (e) {}
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        setHasTorchCapability(Boolean(capabilities.torch));
      }

      // Enumerate available cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
      } catch (e) {}

    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in your browser or upload a QR image below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No video camera was detected on this device. You can upload or drop a QR code image to scan it.');
      } else {
        setCameraError(err.message || 'Unable to start camera stream.');
      }
    }
  }, [facingMode, selectedDeviceId]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Frame processing loop with jsQR
  const scanFrame = useCallback(() => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          const parsed = parseQRData(code.data);
          playBeepSound();
          setLastScannedResult(parsed);
          setIsScanning(false);
          onScanResult(parsed);
          return;
        }
      }
    }

    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
  }, [isScanning, onScanResult, playBeepSound]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (hasCameraPermission && isScanning) {
      animationFrameId.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [hasCameraPermission, isScanning, scanFrame]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn('Torch toggle not supported:', e);
      }
    }
  };

  // Flip Camera (Front / Back)
  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Process image file for QR scanning
  const handleImageUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            const parsed = parseQRData(code.data);
            playBeepSound();
            setLastScannedResult(parsed);
            setIsScanning(false);
            onScanResult(parsed);
          } else {
            alert('No valid QR code was detected in the uploaded image. Please try a clearer screenshot or photo.');
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleResumeScanning = () => {
    setLastScannedResult(null);
    setIsScanning(true);
  };

  const handleCopyResult = () => {
    if (!lastScannedResult) return;
    navigator.clipboard.writeText(lastScannedResult.raw);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Scanner Viewport */}
      <div 
        className={`relative w-full aspect-square max-w-[340px] rounded-3xl overflow-hidden bg-black border-2 transition-all ${
          lastScannedResult 
            ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' 
            : 'border-theme shadow-xl'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageUpload(e.dataTransfer.files[0]);
          }
        }}
      >
        {/* Hidden Canvas for Decoding */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video Element for Camera Stream */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          muted
          autoPlay
          playsInline
        />

        {/* Camera Permission / Error Fallback Overlay */}
        {cameraError && (
          <div className="absolute inset-0 bg-neutral-900/90 p-6 flex flex-col items-center justify-center text-center text-white z-20">
            <CameraOff className="w-12 h-12 text-amber-400 mb-3" />
            <h4 className="font-bold text-sm mb-1">Camera Stream Unavailable</h4>
            <p className="text-xs text-neutral-300 mb-4 leading-relaxed">{cameraError}</p>
            
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer shadow-md">
              <Upload className="w-4 h-4" />
              <span>Upload QR Image / Screenshot</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }} 
              />
            </label>
          </div>
        )}

        {/* Drag & Drop Overlay */}
        {dragActive && (
          <div className="absolute inset-0 bg-emerald-600/80 backdrop-blur-xs flex flex-col items-center justify-center text-white z-30 animate-in fade-in">
            <Upload className="w-12 h-12 mb-2 animate-bounce" />
            <p className="text-sm font-bold">Drop QR Image Here to Scan</p>
          </div>
        )}

        {/* Live HUD Aiming Reticle (Only when active scanning) */}
        {!cameraError && isScanning && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Darkened Vignette Mask */}
            <div className="w-[72%] h-[72%] border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

              {/* Laser Scanning Line Animation */}
              <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10B981] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>

            <span className="mt-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-medium text-white/90 border border-white/20">
              Align QR Code inside frame
            </span>
          </div>
        )}

        {/* Top Controls Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white border border-white/15">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              In-App Scanner
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight Button */}
            {hasTorchCapability && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-full backdrop-blur-md border transition cursor-pointer ${
                  torchEnabled
                    ? 'bg-amber-400 text-black border-amber-300'
                    : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                }`}
                title={torchEnabled ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
              >
                {torchEnabled ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
              </button>
            )}

            {/* Flip Camera Button */}
            {cameraDevices.length > 1 && (
              <button
                type="button"
                onClick={flipCamera}
                className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 hover:bg-black/80 transition cursor-pointer"
                title="Switch Camera"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Upload & Re-scan Overlay Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
          <label className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-white/20 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload Image</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleImageUpload(e.target.files[0]);
                }
              }} 
            />
          </label>

          {!isScanning && (
            <button
              type="button"
              onClick={handleResumeScanning}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan Again</span>
            </button>
          )}
        </div>
      </div>

      {/* Scanned Result Card */}
      {lastScannedResult && (
        <div className="w-full mt-4 p-4 rounded-2xl bg-theme-surface border border-emerald-500/40 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {lastScannedResult.type === 'transfer_pin' ? (
                  <KeyRound className="w-4 h-4" />
                ) : lastScannedResult.type === 'vault_bundle' ? (
                  <Archive className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                  {lastScannedResult.type === 'transfer_pin'
                    ? 'StudyOS Device Sync PIN'
                    : lastScannedResult.type === 'vault_bundle'
                    ? 'Study Vault Package'
                    : 'Scanned Content'}
                </span>
                <h4 className="text-xs font-bold text-primary truncate max-w-[200px]">
                  {lastScannedResult.displayText}
                </h4>
              </div>
            </div>

            <button
              onClick={handleCopyResult}
              className="p-1.5 rounded-lg bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs flex items-center gap-1 transition cursor-pointer"
              title="Copy Raw Content"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onScanResult(lastScannedResult)}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              {lastScannedResult.type === 'transfer_pin' ? (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Connect & Redeem PIN</span>
                </>
              ) : lastScannedResult.type === 'vault_bundle' ? (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Import Vault Package</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Process In App</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
