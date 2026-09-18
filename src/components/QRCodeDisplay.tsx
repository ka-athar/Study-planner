import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, QrCode, Smartphone, Camera, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { InAppQRScanner, ParsedQRResult } from './InAppQRScanner';

interface QRCodeDisplayProps {
  value?: string;
  transferPin?: string;
  syncEmail?: string;
  syncUid?: string;
  deviceName?: string;
  size?: number;
  title?: string;
  subtitle?: string;
  onCopySuccess?: () => void;
  onScannedInApp?: (result: ParsedQRResult) => void;
  allowInAppScan?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  transferPin,
  syncEmail,
  syncUid,
  deviceName,
  size = 180,
  title = 'Scan to Link Device',
  subtitle = 'Open camera on your other device or scan another device\'s code in-app.',
  onCopySuccess,
  onScannedInApp,
  allowInAppScan = true
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'display' | 'scan'>('display');

  // Compute target URL instantly
  const resolvedUrl = React.useMemo(() => {
    if (value) return value;
    if (transferPin) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
      const emailParam = syncEmail ? `&sync_email=${encodeURIComponent(syncEmail)}` : '';
      const uidParam = syncUid ? `&sync_uid=${encodeURIComponent(syncUid)}` : '';
      return `${origin}${pathname}?transfer_code=${transferPin}${emailParam}${uidParam}`;
    }
    return '';
  }, [value, transferPin, syncEmail, syncUid]);

  useEffect(() => {
    if (!resolvedUrl) return;

    let isMounted = true;
    QRCode.toDataURL(resolvedUrl, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'L' // Low error correction for ultra-fast generation and simpler scan matrix
    })
      .then(url => {
        if (isMounted) {
          setDataUrl(url);
          setError(null);
        }
      })
      .catch(err => {
        console.error('QR code generation error:', err);
        if (isMounted) setError('Failed to generate QR code.');
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedUrl, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopied(true);
      if (onCopySuccess) onCopySuccess();
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {}
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `studyflow-device-link-qr-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="flex flex-col items-center text-center p-4 rounded-3xl bg-theme-card border border-theme shadow-md max-w-sm mx-auto overflow-hidden transition-all">
      {/* Mode Switcher Tabs (Display QR vs Scan In-App) */}
      {allowInAppScan && (
        <div className="flex p-1 bg-theme-surface rounded-2xl border border-theme mb-3 w-full max-w-[280px]">
          <button
            type="button"
            onClick={() => setActiveMode('display')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'display'
                ? 'bg-theme-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-theme'
                : 'text-muted hover:text-primary'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('scan')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'scan'
                ? 'bg-theme-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-theme'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-emerald-500" />
            <span>Scan In-App</span>
          </button>
        </div>
      )}

      {activeMode === 'display' ? (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-primary">{title}</h4>
          </div>

          <p className="text-xs text-muted mb-3 max-w-[260px] leading-relaxed">
            {subtitle}
          </p>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl shadow-inner border border-stone-200 dark:border-stone-700 relative group mb-3">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt="Device Link QR Code"
                style={{ width: `${size}px`, height: `${size}px` }}
                className="rounded-lg select-none"
              />
            ) : error ? (
              <div style={{ width: `${size}px`, height: `${size}px` }} className="flex items-center justify-center text-xs text-rose-500">
                {error}
              </div>
            ) : (
              <div style={{ width: `${size}px`, height: `${size}px` }} className="flex items-center justify-center text-xs text-muted animate-pulse">
                Generating QR Code...
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full max-w-[280px]">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2 px-3 rounded-xl bg-theme-accent hover:opacity-90 border border-theme text-xs font-semibold text-primary flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Copy Direct URL'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!dataUrl}
              title="Download QR Code image"
              className="p-2 rounded-xl bg-theme-accent hover:opacity-90 border border-theme text-primary transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
            <Smartphone className="w-3 h-3 text-emerald-500" />
            <span>In-App Scanner & Camera Native Support</span>
          </div>
        </>
      ) : (
        <div className="w-full">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-primary">Live In-App Scanner</h4>
            <p className="text-xs text-muted">Point your camera at another screen to link instantly without opening another browser</p>
          </div>

          <InAppQRScanner
            onScanResult={(result) => {
              if (onScannedInApp) {
                onScannedInApp(result);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
