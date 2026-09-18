/**
 * Safe Base64 & UTF-8 conversion utilities.
 * Handles binary files, PDFs, Google Drive payloads, and UTF-8 emails without
 * throwing DOMException / 'string did not match pattern' or maximum call stack errors.
 */

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64(bytes);
}

export function base64UrlEncode(strOrBuffer: string | ArrayBuffer | Uint8Array): string {
  const base64 = typeof strOrBuffer === 'string' ? utf8ToBase64(strOrBuffer) : arrayBufferToBase64(strOrBuffer);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function fileOrBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file content'));
    reader.readAsDataURL(blob);
  });
}

export async function compressImageFile(
  file: File | Blob, 
  maxDimension: number = 1400, 
  quality: number = 0.85
): Promise<{ base64: string; dataUrl: string; mimeType: string; fileName: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      const fileName = file instanceof File ? file.name : 'captured_image.jpg';
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const cleanBase64 = rawResult.includes(',') ? rawResult.split(',')[1] : rawResult;
          resolve({
            base64: cleanBase64,
            dataUrl: rawResult,
            mimeType: (file as File).type || 'image/jpeg',
            fileName,
            sizeBytes: file.size
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mime = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, quality);
        const base64 = dataUrl.split(',')[1];
        resolve({
          base64,
          dataUrl,
          mimeType: mime,
          fileName,
          sizeBytes: Math.round((base64.length * 3) / 4)
        });
      };
      img.onerror = () => {
        // If image object fails to load directly, fallback to data url
        const cleanBase64 = rawResult.includes(',') ? rawResult.split(',')[1] : rawResult;
        resolve({
          base64: cleanBase64,
          dataUrl: rawResult,
          mimeType: (file as File).type || 'image/jpeg',
          fileName,
          sizeBytes: file.size
        });
      };
      img.src = rawResult;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

