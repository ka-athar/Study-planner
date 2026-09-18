import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Share2, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  FolderLock, 
  Tag, 
  FileText, 
  DollarSign, 
  Users, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  PackageCheck,
  QrCode,
  Camera
} from 'lucide-react';
import { StorageVault, TestResult, UserProfile } from '../types';
import { 
  packageVaultForTransfer, 
  downloadVaultBundleFile, 
  unpackVaultTransferBundle, 
  VaultLicenseType, 
  VaultTransferBundle 
} from '../lib/vaultTransferService';
import { InAppQRScanner, ParsedQRResult } from './InAppQRScanner';
import { QRCodeDisplay } from './QRCodeDisplay';

interface VaultTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault?: StorageVault | null;
  allVaults?: StorageVault[];
  allTests?: TestResult[];
  userProfile?: UserProfile | null;
  onImportVault: (vault: Omit<StorageVault, 'id'>, tests?: Omit<TestResult, 'id'>[]) => Promise<void> | void;
}

export const VaultTransferModal: React.FC<VaultTransferModalProps> = ({
  isOpen,
  onClose,
  vault,
  allVaults = [],
  allTests = [],
  userProfile,
  onImportVault
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  
  // Export State
  const [selectedVaultId, setSelectedVaultId] = useState<string>(vault?.id || allVaults[0]?.id || '');
  const [licenseType, setLicenseType] = useState<VaultLicenseType>('open_community');
  const [priceCredits, setPriceCredits] = useState<number>(0);
  const [authorName, setAuthorName] = useState<string>(userProfile?.displayName || userProfile?.name || 'Academic Scholar');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [generatedBundle, setGeneratedBundle] = useState<VaultTransferBundle | null>(null);

  // Import State
  const [importText, setImportText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [parsedPreview, setParsedPreview] = useState<VaultTransferBundle | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState<boolean>(false);
  const [isScanningQR, setIsScanningQR] = useState<boolean>(false);
  const [showExportQR, setShowExportQR] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleScanVaultResult = (scanRes: ParsedQRResult) => {
    if (scanRes.data && (scanRes.type === 'vault_bundle' || scanRes.data.vaultTransferBundle || scanRes.data.vault)) {
      const rawBundle = scanRes.data.vaultTransferBundle || scanRes.data;
      if (rawBundle.vault) {
        setParsedPreview(rawBundle);
        setImportStatus({
          type: 'success',
          message: `Verified Vault "${rawBundle.vault.name}". Ready to import into your library!`
        });
        setIsScanningQR(false);
        return;
      }
    }
    
    if (scanRes.transferPin || scanRes.type === 'transfer_pin') {
      const pin = scanRes.transferPin || scanRes.raw;
      setImportText(pin);
      setIsScanningQR(false);
      setImportStatus({
        type: 'success',
        message: `Scanned Device Transfer Code: ${pin}. You can also use this in Device Sync!`
      });
      return;
    }

    if (scanRes.raw) {
      try {
        const parsed = JSON.parse(scanRes.raw);
        const res = unpackVaultTransferBundle(parsed);
        if (res.success && res.bundle) {
          setParsedPreview(res.bundle);
          setImportStatus({
            type: 'success',
            message: `Verified Vault "${res.bundle.vault.name}". Ready to import!`
          });
          setIsScanningQR(false);
          return;
        }
      } catch (e) {}

      setImportText(scanRes.raw);
      setIsScanningQR(false);
    }
  };

  const targetVault = allVaults.find(v => v.id === selectedVaultId) || vault || allVaults[0];

  const handleGenerateBundle = () => {
    if (!targetVault) return;
    const bundle = packageVaultForTransfer(targetVault, allTests, {
      authorName,
      authorEmail: userProfile?.email || '',
      license: licenseType,
      priceCredits: priceCredits > 0 ? priceCredits : undefined,
      priceLabel: priceCredits > 0 ? `$${priceCredits} Premium Kit` : 'Free Open Kit'
    });
    setGeneratedBundle(bundle);
  };

  const handleCopyCode = () => {
    if (!generatedBundle) return;
    navigator.clipboard.writeText(generatedBundle.transferCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyJson = () => {
    if (!generatedBundle) return;
    navigator.clipboard.writeText(JSON.stringify(generatedBundle, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadFile = () => {
    if (!generatedBundle) return;
    downloadVaultBundleFile(generatedBundle);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportText(content);
      const res = unpackVaultTransferBundle(content);
      if (res.success && res.bundle) {
        setParsedPreview(res.bundle);
        setImportStatus({ type: 'success', message: `Valid Vault Package found: "${res.bundle.vault.name}"` });
      } else {
        setParsedPreview(null);
        setImportStatus({ type: 'error', message: res.error || 'Invalid file format' });
      }
    };
    reader.readAsText(file);
  };

  const handleParseText = () => {
    if (!importText.trim()) return;
    const res = unpackVaultTransferBundle(importText);
    if (res.success && res.bundle) {
      setParsedPreview(res.bundle);
      setImportStatus({ type: 'success', message: `Valid Vault Package verified: "${res.bundle.vault.name}"` });
    } else {
      setParsedPreview(null);
      setImportStatus({ type: 'error', message: res.error || 'Failed to parse JSON payload.' });
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedPreview) return;
    setIsProcessingImport(true);
    try {
      const { vault: importedVault, linkedTests } = parsedPreview;
      await onImportVault(importedVault, linkedTests);
      setImportStatus({ type: 'success', message: `Successfully imported "${importedVault.name}" with ${linkedTests.length} linked test items!` });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: `Import failed: ${err.message || err}` });
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-theme-card border border-theme rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-theme-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Vault Transfer & Study Kit Exchange</h2>
              <p className="text-xs text-muted">Package, export, distribute, or import complete study vaults across peers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-theme-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-theme bg-theme-surface/30">
          <button
            onClick={() => { setActiveTab('export'); setGeneratedBundle(null); }}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-theme-card'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Download className="w-4 h-4" />
            Export & Package Vault
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-theme-card'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Upload className="w-4 h-4" />
            Import / Receive Vault
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'export' ? (
            <>
              {/* Select Vault */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Select Storage Vault to Package
                </label>
                <select
                  value={selectedVaultId}
                  onChange={(e) => {
                    setSelectedVaultId(e.target.value);
                    setGeneratedBundle(null);
                  }}
                  className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                >
                  {allVaults.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.icon || '🗄️'} {v.name} ({v.subjectName} • {v.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* License & Commercial Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Distribution License
                  </label>
                  <select
                    value={licenseType}
                    onChange={(e) => {
                      setLicenseType(e.target.value as VaultLicenseType);
                      setGeneratedBundle(null);
                    }}
                    className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="open_community">Open Community Kit (Free for all)</option>
                    <option value="peer_study_kit">Study Group Exclusive</option>
                    <option value="premium_masterclass">Premium Study Kit / Sold Pack</option>
                    <option value="private_transfer">Private Device Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Study Kit Tag Price ($ / Free)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={priceCredits}
                      onChange={(e) => {
                        setPriceCredits(parseFloat(e.target.value) || 0);
                        setGeneratedBundle(null);
                      }}
                      placeholder="0 (Free)"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-theme-surface border border-theme rounded-xl text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Author & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Creator / Author Name
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => { setAuthorName(e.target.value); setGeneratedBundle(null); }}
                    className="w-full bg-theme-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    Subject Context
                  </label>
                  <div className="px-3.5 py-2.5 bg-theme-surface/50 border border-theme rounded-xl text-sm text-muted font-medium">
                    {targetVault?.subjectName || 'General STEM'} • {targetVault?.tags?.length || 0} curriculum tags
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              {!generatedBundle ? (
                <button
                  onClick={handleGenerateBundle}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  Package Vault into Transfer Bundle
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Transfer Code
                      </span>
                      <div className="text-2xl font-mono font-black text-primary tracking-wider mt-0.5">
                        {generatedBundle.transferCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowExportQR(!showExportQR)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="Display QR code to scan from another device"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{showExportQR ? 'Hide QR' : 'Show QR'}</span>
                      </button>
                      <button
                        onClick={handleCopyCode}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </button>
                    </div>
                  </div>

                  {showExportQR && (
                    <div className="p-3 bg-theme-surface rounded-2xl border border-theme flex flex-col items-center">
                      <QRCodeDisplay
                        transferPin={generatedBundle.transferCode}
                        title={`Scan ${generatedBundle.vault.name}`}
                        subtitle="Scan this QR code from another device inside StudyOS to import this vault bundle instantly"
                        size={150}
                        allowInAppScan={false}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <span className="px-2.5 py-1 rounded-md bg-theme-surface border border-theme">
                      📦 {generatedBundle.metadata.itemCount} Linked Tests
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-theme-surface border border-theme">
                      🏆 {generatedBundle.metadata.totalTestPoints} Total Marks
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-theme-surface border border-theme">
                      🏷️ {generatedBundle.metadata.priceLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleDownloadFile}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download .vault.json
                    </button>
                    <button
                      onClick={handleCopyJson}
                      className="flex-1 py-2.5 bg-theme-surface hover:bg-theme-accent border border-theme text-primary rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <FileText className="w-3.5 h-3.5" />}
                      {copiedJson ? 'JSON Copied' : 'Copy JSON'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Import Tab */}
              {/* Option 1: In-App Camera QR Scanner */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-primary">Scan QR Code In-App</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsScanningQR(!isScanningQR)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{isScanningQR ? 'Close Camera' : 'Open In-App Camera'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted mb-3">
                  Scan a vault transfer QR code shown on another laptop, tablet, or phone screen directly without opening a new browser tab.
                </p>

                {isScanningQR && (
                  <div className="mt-3 p-3 bg-theme-card rounded-2xl border border-theme flex flex-col items-center">
                    <InAppQRScanner
                      onScanResult={handleScanVaultResult}
                      onClose={() => setIsScanningQR(false)}
                    />
                  </div>
                )}
              </div>

              {/* Option 2: Upload File */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Or Upload .vault.json File
                </label>
                <label className="border-2 border-dashed border-theme hover:border-emerald-500/50 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer bg-theme-surface/30 hover:bg-theme-surface/70 transition">
                  <Upload className="w-7 h-7 text-muted mb-2" />
                  <span className="text-sm font-semibold text-primary">Click to select .vault.json file</span>
                  <span className="text-xs text-muted mt-1">Accepts exported StudyOS Vault bundles</span>
                  <input
                    type="file"
                    accept=".json,.vault.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Option 3: Paste JSON or Code */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Or Paste Vault JSON / Transfer PIN
                </label>
                <textarea
                  rows={3}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='Paste {"version": "2.0", ...} or a 6-digit Transfer PIN here...'
                  className="w-full bg-theme-surface border border-theme rounded-xl p-3 text-xs font-mono text-primary focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleParseText}
                    className="px-4 py-1.5 bg-theme-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Verify Payload
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {importStatus.type !== 'idle' && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  importStatus.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {importStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{importStatus.message}</span>
                </div>
              )}

              {/* Preview Card */}
              {parsedPreview && (
                <div className="p-4 rounded-xl border border-theme bg-theme-surface/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                      <span>{parsedPreview.vault.icon || '🗄️'}</span>
                      <span>{parsedPreview.vault.name}</span>
                    </h4>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                      {parsedPreview.metadata.priceLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{parsedPreview.metadata.summary}</p>
                  <div className="text-[11px] text-muted flex gap-3 pt-1">
                    <span>Subject: <strong>{parsedPreview.vault.subjectName}</strong></span>
                    <span>Category: <strong>{parsedPreview.vault.category}</strong></span>
                    <span>Tests Included: <strong>{parsedPreview.linkedTests.length}</strong></span>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isProcessingImport}
                    className="w-full mt-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {isProcessingImport ? 'Importing...' : 'Add Vault & Tests to My Workspace'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
