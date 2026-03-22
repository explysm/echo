import { Platform, NativeModules } from 'react-native';

const isDesktop = Platform.OS === 'web' && 
  (typeof window !== 'undefined' && 
   (window.navigator.userAgent.includes('Electron') || 
    (window as any).__TAURI_INTERNALS__?.window !== undefined));

const blobUrlCache = new Map<string, string>();

export async function getAudioSrc(fileUri: string, fileName?: string): Promise<string> {
  if (isDesktop) {
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      return convertFileSrc(fileUri);
    } catch {
      return await createBlobUrl(fileUri, fileName);
    }
  }
  
  if (Platform.OS === 'web') {
    return await createBlobUrl(fileUri, fileName);
  }
  
  return fileUri;
}

export async function createBlobUrl(fileUri: string, fileName?: string): Promise<string> {
  if (blobUrlCache.has(fileUri)) {
    return blobUrlCache.get(fileUri)!;
  }

  try {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(fileUri, blobUrl);
    return blobUrl;
  } catch (error) {
    console.warn('Failed to create blob URL, using original URI:', error);
    return fileUri;
  }
}

export function revokeBlobUrl(fileUri: string): void {
  const blobUrl = blobUrlCache.get(fileUri);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrlCache.delete(fileUri);
  }
}

export function revokeAllBlobUrls(): void {
  blobUrlCache.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
  blobUrlCache.clear();
}

export function isAudioFile(fileName: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.opus'];
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return audioExtensions.includes(ext);
}

export function isLrcFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.lrc');
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}
