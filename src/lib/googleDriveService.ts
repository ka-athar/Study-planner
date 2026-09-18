/**
 * Google Drive Integration Service
 * Browse, search, upload backups, and link Google Drive study documents via Google Drive API v3.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { arrayBufferToBase64 } from './base64Utils';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  starred?: boolean;
}

/**
 * Lists or searches files from the user's Google Drive.
 */
export async function listDriveFiles(options?: {
  query?: string;
  pageSize?: number;
  folderId?: string;
  mimeTypeFilter?: 'all' | 'documents' | 'spreadsheets' | 'pdfs' | 'folders';
}, tokenOverride?: string): Promise<DriveFileItem[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }
  const pageSize = options?.pageSize || 40;

  const queryParts: string[] = ['trashed = false'];

  if (options?.query && options.query.trim() !== '') {
    queryParts.push(`name contains '${options.query.trim().replace(/'/g, "\\'")}'`);
  }

  if (options?.folderId) {
    queryParts.push(`'${options.folderId}' in parents`);
  }

  if (options?.mimeTypeFilter) {
    if (options.mimeTypeFilter === 'documents') {
      queryParts.push("(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/msword' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'text/plain')");
    } else if (options.mimeTypeFilter === 'spreadsheets') {
      queryParts.push("(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'text/csv')");
    } else if (options.mimeTypeFilter === 'pdfs') {
      queryParts.push("mimeType = 'application/pdf'");
    } else if (options.mimeTypeFilter === 'folders') {
      queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
    }
  }

  const q = queryParts.join(' and ');
  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields: 'files(id, name, mimeType, iconLink, webViewLink, thumbnailLink, size, modifiedTime, createdTime, starred)',
    orderBy: 'modifiedTime desc',
  });

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Drive fetch failed with status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.warn('Network error fetching drive files:', error);
    return [];
  }
}

/**
 * Creates or finds the "StudyFlow" folder in Google Drive.
 */
export async function getOrCreateStudyFolder(): Promise<string> {
  const token = await getOrRequestWorkspaceToken();
  
  // Check if folder exists
  const searchParams = new URLSearchParams({
    q: "name = 'StudyOS Academic Workspace' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
  });

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'StudyOS Academic Workspace',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Dedicated Directory for StudyOS study notes, syllabus backups, lecture materials, and revision decks.'
    })
  });

  if (!createRes.ok) {
    throw new Error('Failed to create StudyOS Academic Workspace folder in Google Drive');
  }

  const folder = await createRes.json();
  return folder.id;
}

/**
 * Uploads a study backup or study note JSON/Markdown file to Google Drive.
 */
export async function uploadStudyBackupToDrive(
  data: any,
  fileName: string = `StudyOS_Academic_Vault_Snapshot_${new Date().toISOString().split('T')[0]}.json`
): Promise<{ success: boolean; fileId: string; webViewLink?: string }> {
  const token = await getOrRequestWorkspaceToken();
  const folderId = await getOrCreateStudyFolder().catch(() => undefined);

  const metadata: any = {
    name: fileName,
    mimeType: 'application/json',
    description: 'Autonomous complete study schedule, syllabus records, and revision progress snapshot from StudyOS'
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const fileContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const boundary = `-------314159265358979323846_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Drive upload failed (${response.status})`);
  }

  const result = await response.json();
  return {
    success: true,
    fileId: result.id,
    webViewLink: result.webViewLink
  };
}

/**
 * Creates a formatted Study Notes document in Google Drive.
 */
export async function createStudyNoteDocInDrive(
  title: string,
  contentMarkdown: string,
  subject?: string
): Promise<{ id: string; webViewLink: string }> {
  const token = await getOrRequestWorkspaceToken();
  const folderId = await getOrCreateStudyFolder().catch(() => undefined);

  const fileName = `${subject ? `[${subject}] ` : ''}${title}.txt`;
  const metadata: any = {
    name: fileName,
    mimeType: 'text/plain',
    description: `Study note created by StudyFlow on ${new Date().toLocaleDateString()}`
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = `-------DOC_STUDY_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    contentMarkdown +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create note in Google Drive (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes a file from Google Drive (Requires user confirmation before calling).
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const token = await getOrRequestWorkspaceToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok && response.status !== 404) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to delete Drive file (${response.status})`);
  }

  return true;
}

/**
 * Downloads or exports the text content of a file from Google Drive.
 * Supports Google Docs (exported as plain text), text/markdown files, and JSON backup files.
 */
export async function downloadDriveFileContent(fileId: string, mimeType?: string): Promise<string> {
  const token = await getOrRequestWorkspaceToken();
  
  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  // Google Docs cannot be downloaded directly via alt=media; they must be exported
  if (mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to download file content from Drive (${response.status})`);
  }

  return await response.text();
}

export async function downloadDriveFileBinary(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const token = await getOrRequestWorkspaceToken();
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meta = await metaRes.json().catch(() => ({}));
  const mimeType = meta.mimeType || 'application/pdf';

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`Failed to download binary file from Google Drive (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return { base64, mimeType };
}

/**
 * Lists all previous backup snapshot files stored in the dedicated StudyOS folder on Google Drive.
 */
export async function listVaultBackups(): Promise<DriveFileItem[]> {
  try {
    const folderId = await getOrCreateStudyFolder();
    return await listDriveFiles({
      folderId,
      query: 'Backup',
      pageSize: 30
    });
  } catch (err) {
    console.warn('Failed to list vault backups:', err);
    return [];
  }
}

/**
 * Downloads and restores the full JSON snapshot from a selected Google Drive backup file.
 */
export async function restoreFromDriveBackup(fileId: string): Promise<any> {
  const textContent = await downloadDriveFileContent(fileId, 'application/json');
  try {
    return JSON.parse(textContent);
  } catch (err: any) {
    throw new Error(`The selected backup file is not valid JSON: ${err.message}`);
  }
}

