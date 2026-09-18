import { StorageVault, TestResult } from '../types';

export type VaultLicenseType = 'open_community' | 'peer_study_kit' | 'premium_masterclass' | 'private_transfer';

export interface VaultTransferBundle {
  version: '2.0';
  exportedAt: string;
  transferCode: string;
  vault: StorageVault;
  linkedTests: TestResult[];
  metadata: {
    authorName?: string;
    authorEmail?: string;
    license: VaultLicenseType;
    priceCredits?: number;
    priceLabel?: string;
    summary: string;
    itemCount: number;
    totalTestPoints: number;
    checksum: string;
  };
}

/**
 * Generates an alphanumeric 8-character transfer code for quick peer sharing
 */
export function generateVaultTransferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VLT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Packages a StorageVault and its associated TestResults into a transfer bundle
 */
export function packageVaultForTransfer(
  vault: StorageVault,
  allTests: TestResult[],
  options?: {
    authorName?: string;
    authorEmail?: string;
    license?: VaultLicenseType;
    priceCredits?: number;
    priceLabel?: string;
  }
): VaultTransferBundle {
  const linkedTests = allTests.filter(t => t.vaultId === vault.id || t.subjectName === vault.subjectName);
  const totalTestPoints = linkedTests.reduce((acc, t) => acc + (t.totalMarks || t.maxScore || 100), 0);
  const transferCode = generateVaultTransferCode();

  const bundle: VaultTransferBundle = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    transferCode,
    vault: {
      ...vault,
      id: `vault-pkg-${Date.now()}`
    },
    linkedTests: linkedTests.map(t => ({
      ...t,
      id: `test-pkg-${Math.random().toString(36).substring(2, 9)}`,
      userId: ''
    })),
    metadata: {
      authorName: options?.authorName || 'StudyOS Scholar',
      authorEmail: options?.authorEmail || '',
      license: options?.license || 'open_community',
      priceCredits: options?.priceCredits || 0,
      priceLabel: options?.priceLabel || (options?.priceCredits && options.priceCredits > 0 ? `$${options.priceCredits} / Free for Study Group` : 'Free Open Kit'),
      summary: vault.description || `Comprehensive ${vault.subjectName} storage vault and exam study kit.`,
      itemCount: linkedTests.length,
      totalTestPoints,
      checksum: `vlt-${vault.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`
    }
  };

  return bundle;
}

/**
 * Downloads the Vault as a portable `.vault.json` file
 */
export function downloadVaultBundleFile(bundle: VaultTransferBundle) {
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanName = (bundle.vault.name || 'study-vault').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.download = `${cleanName}.vault.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and unpacks a transfer bundle JSON string
 */
export function unpackVaultTransferBundle(jsonText: string): {
  success: boolean;
  bundle?: VaultTransferBundle;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText.trim());
    if (!parsed.vault || !parsed.vault.name || !parsed.vault.subjectName) {
      return { success: false, error: 'Invalid vault payload: Missing core vault definition or subject name.' };
    }

    // Standardize structure
    const bundle: VaultTransferBundle = {
      version: parsed.version || '2.0',
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      transferCode: parsed.transferCode || generateVaultTransferCode(),
      vault: {
        ...parsed.vault,
        id: `vault-imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      },
      linkedTests: Array.isArray(parsed.linkedTests)
        ? parsed.linkedTests.map((t: any) => ({
            ...t,
            id: `test-imported-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
          }))
        : [],
      metadata: parsed.metadata || {
        license: 'open_community',
        summary: parsed.vault.description || 'Imported Storage Vault',
        itemCount: Array.isArray(parsed.linkedTests) ? parsed.linkedTests.length : 0,
        totalTestPoints: 100,
        checksum: `import-${Date.now()}`
      }
    };

    return { success: true, bundle };
  } catch (err: any) {
    return { success: false, error: `Failed to parse Vault JSON: ${err.message || err}` };
  }
}
