import jsQR from 'jsqr';
import { StorageVault, TestResult, Subject, StudyPlan } from '../types';

export type ParsedQRType = 
  | 'device_sync_pin' 
  | 'vault_bundle' 
  | 'in_app_navigation' 
  | 'study_syllabus' 
  | 'flashcard_deck' 
  | 'external_url' 
  | 'plain_text';

export interface ParsedQRResult {
  raw: string;
  type: ParsedQRType;
  title: string;
  description: string;
  actionLabel: string;
  data?: any;
  pin?: string;
  email?: string;
  targetTab?: string;
  vaultBundle?: any;
}

/**
 * Parses raw text or URL scanned from a QR code and identifies StudyOS payloads
 */
export function parseScannedQRCode(rawText: string): ParsedQRResult {
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    return {
      raw: '',
      type: 'plain_text',
      title: 'Empty QR Code',
      description: 'No data was found in the scanned QR code.',
      actionLabel: 'Scan Again'
    };
  }

  // 1. Check if it's a 6-digit numeric PIN
  const cleanDigits = trimmed.replace(/[^0-9]/g, '');
  if (/^[0-9]{6}$/.test(trimmed) || (/^[0-9]{3}\s?[0-9]{3}$/.test(trimmed) && cleanDigits.length === 6)) {
    return {
      raw: trimmed,
      type: 'device_sync_pin',
      title: 'Device Transfer PIN Detected',
      description: `6-Digit device pairing code: ${cleanDigits}. Connects all syllabus, assignments, and test records.`,
      actionLabel: 'Link & Sync Device Now',
      pin: cleanDigits
    };
  }

  // 2. Check if it's a StudyOS URL with parameters (transfer_code, tab, sync_email, vault_code, etc.)
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('studyflow://') || trimmed.includes('?')) {
      // Parse URL or search string
      const urlObj = trimmed.startsWith('http') ? new URL(trimmed) : new URL(`https://studyflow.app${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
      const params = urlObj.searchParams;

      const transferCode = params.get('transfer_code') || params.get('code') || params.get('pin');
      const syncEmail = params.get('sync_email') || params.get('email');
      const tabParam = params.get('tab');
      const vaultCode = params.get('vault_code') || params.get('vault');

      if (transferCode && transferCode.replace(/[^0-9]/g, '').length >= 6) {
        const pin = transferCode.replace(/[^0-9]/g, '').slice(0, 6);
        return {
          raw: trimmed,
          type: 'device_sync_pin',
          title: 'Cross-Device Pairing Link Detected',
          description: `Device sync link with Transfer PIN: ${pin}${syncEmail ? ` for ${syncEmail}` : ''}. Overwrite & pair seamlessly in-app!`,
          actionLabel: 'Pair Device & Import Data',
          pin,
          email: syncEmail || undefined
        };
      }

      if (vaultCode) {
        return {
          raw: trimmed,
          type: 'vault_bundle',
          title: 'Storage Vault Transfer Code',
          description: `Vault transfer code: ${vaultCode}. Click to load and unpack this study vault.`,
          actionLabel: 'Import Study Vault',
          data: { vaultCode }
        };
      }

      if (tabParam) {
        const tabLabels: Record<string, string> = {
          dashboard: 'Dashboard',
          assignments: 'Assignments',
          classroom: 'Classroom Hub',
          groups: 'Study Circles',
          flashcards: 'Flashcard Arena',
          syllabus: 'Syllabus Tracker',
          planner: 'AI Study Planner',
          timer: 'Focus Timer',
          calendar: 'Academic Calendar',
          progress: 'Progress & Heatmap',
          revision: 'Spaced Revision',
          tests: 'Test Performance',
          vaults: 'Storage Vaults',
          tutor: 'AI Academic Tutor',
          settings: 'Settings'
        };
        return {
          raw: trimmed,
          type: 'in_app_navigation',
          title: `In-App Navigation: ${tabLabels[tabParam] || tabParam}`,
          description: `Direct deep link to the ${tabLabels[tabParam] || tabParam} section inside StudyPlanner.`,
          actionLabel: `Go to ${tabLabels[tabParam] || tabParam}`,
          targetTab: tabParam
        };
      }

      return {
        raw: trimmed,
        type: 'external_url',
        title: 'Academic Resource Link',
        description: trimmed,
        actionLabel: 'Open Link'
      };
    }
  } catch (e) {
    // Ignore URL parse error and continue to JSON check
  }

  // 3. Check if it's a JSON payload (Vault bundle, Syllabus, Study Plan, Flashcards)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);

      // Vault bundle check
      if (json.vault || json.transferCode || (json.app && json.app.includes('PrepForge')) || json.vaultTransferBundle) {
        const bundle = json.vaultTransferBundle || json;
        const vaultName = bundle.vault?.name || 'Academic Study Vault';
        return {
          raw: trimmed,
          type: 'vault_bundle',
          title: `Vault Bundle: "${vaultName}"`,
          description: `Includes ${bundle.vault?.chapters?.length || 0} chapters and ${bundle.tests?.length || 0} test records.`,
          actionLabel: 'Import Storage Vault',
          vaultBundle: bundle
        };
      }

      // Syllabus Subjects payload check
      if (json.subjects || Array.isArray(json)) {
        const count = Array.isArray(json) ? json.length : json.subjects.length;
        return {
          raw: trimmed,
          type: 'study_syllabus',
          title: `Syllabus Blueprint (${count} Subjects)`,
          description: `Ready to import structured academic subjects and topics.`,
          actionLabel: 'Apply Syllabus Blueprint',
          data: json.subjects || json
        };
      }

      // Flashcards payload check
      if (json.cards || json.flashcards || json.deck) {
        const deckName = json.deck?.title || json.title || 'Flashcard Deck';
        const cardsCount = json.cards?.length || json.flashcards?.length || 0;
        return {
          raw: trimmed,
          type: 'flashcard_deck',
          title: `Flashcards: "${deckName}"`,
          description: `Deck containing ${cardsCount} active recall flashcards.`,
          actionLabel: 'Import Flashcards',
          data: json
        };
      }
    } catch (e) {
      // Invalid JSON, fall through
    }
  }

  // 4. Check if it starts with SV- (Storage Vault transfer code)
  if (trimmed.startsWith('SV-') && trimmed.length >= 6) {
    return {
      raw: trimmed,
      type: 'vault_bundle',
      title: 'Vault Transfer Code Detected',
      description: `Storage Vault bundle transfer reference: ${trimmed}.`,
      actionLabel: 'Import Vault Bundle',
      data: { transferCode: trimmed }
    };
  }

  // 5. Default: Plain text
  return {
    raw: trimmed,
    type: 'plain_text',
    title: 'Text Content',
    description: trimmed.length > 150 ? `${trimmed.slice(0, 150)}...` : trimmed,
    actionLabel: 'Copy Text'
  };
}

/**
 * Decodes a QR code from an HTML Video element or Image Canvas
 */
export function decodeQRFromImageData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { data: string; location: any } | null {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    if (code && code.data) {
      return {
        data: code.data,
        location: code.location
      };
    }
  } catch (err) {
    // console.warn('QR decode frame error:', err);
  }
  return null;
}

/**
 * Decodes a QR code from a File or Image Blob
 */
export async function decodeQRFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        resolve(code.data);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}
