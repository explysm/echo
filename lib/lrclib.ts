import * as Crypto from 'expo-crypto';
import Notifications from './notificationHelper';
import { Platform } from 'react-native';

export interface LyricLine {
  id: string;
  start: number;
  end: number | null;
  text: string;
}

export function formatLyricsToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .map((line) => {
      const minutes = Math.floor(line.start / 60);
      const seconds = Math.floor(line.start % 60);
      const centiseconds = Math.floor((line.start % 1) * 100);
      const timestamp = `[${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}]`;
      return `${timestamp}${line.text}`;
    })
    .join('\n');
}

export function parseLRCToLyrics(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const lyrics: LyricLine[] = [];
  const timestampRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  lines.forEach((line) => {
    const match = line.match(timestampRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const text = match[4].trim();
      const start = minutes * 60 + seconds + centiseconds / 100;
      lyrics.push({
        id: Math.random().toString(36).substr(2, 9),
        start,
        end: null,
        text,
      });
    }
  });

  lyrics.sort((a, b) => a.start - b.start);
  for (let i = 0; i < lyrics.length - 1; i++) {
    lyrics[i].end = lyrics[i + 1].start;
  }

  return lyrics;
}

const NOTIFICATION_ID = 'echo-publish-progress';

async function showProgressNotification(title: string, body: string, isDone: boolean = false) {
  if (Platform.OS === 'web') return;
  if (!Notifications || !Notifications.scheduleNotificationAsync) {
    console.warn('Notifications module is not available');
    return;
  }
  
  try {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: isDone,
        shouldSetBadge: false,
      }),
    });

    // Basic request for permissions if not already granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: !isDone,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: null, // Send immediately
    });
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

interface ChallengeResponse {
  prefix: string;
  target: string;
}

async function solveChallenge(
  prefix: string, 
  target: string, 
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  batchSize: number = 50
): Promise<string> {
  let nonce = 0;
  const startTime = Date.now();
  const lowerTarget = target.toLowerCase();
  
  while (true) {
    if (signal?.aborted) throw new Error('Solver aborted');

    // Parallelize hash requests to saturate the bridge/CPU
    const batch = Array.from({ length: batchSize }, (_, i) => {
      const currentNonce = nonce + i;
      return Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        prefix + currentNonce
      ).then(hash => ({ hash, nonce: currentNonce }));
    });

    const results = await Promise.all(batch);
    
    for (const result of results) {
      if (result.hash < lowerTarget) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Solved at nonce ${result.nonce} in ${totalTime}s`);
        await showProgressNotification('Echo Solver', `Solved at nonce ${result.nonce}!`, true);
        return result.nonce.toString();
      }
    }

    nonce += batchSize;
    
    // Update UI/Progress every 1000 nonces to keep overhead low
    if (nonce % 1000 < batchSize) {
      const elapsedSecs = (Date.now() - startTime) / 1000;
      const hashesPerSec = Math.floor(nonce / elapsedSecs || 0);
      const msg = `Solving PoW: nonce ${nonce} (${hashesPerSec} H/s)...`;
      onProgress?.(msg);
      
      // Update notification every 100k nonces
      if (nonce % 100000 < batchSize) {
        await showProgressNotification('Echo Solver (Local)', msg);
      }
      
      // Minimal delay to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

async function fetchRemoteSolver(
  url: string,
  key: string,
  prefix: string,
  target: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ nonce: string; elapsed: number }> {
  return new Promise((resolve, reject) => {
    // Ensure URL doesn't have trailing slash
    const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${cleanUrl}/solve`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-solver-key', key || '');

    if (signal) {
      signal.onabort = () => {
        xhr.abort();
        reject(new Error('Solver aborted'));
      };
    }

    let lastIndex = 0;

    const processText = (text: string) => {
      const newText = text.substring(lastIndex);
      if (!newText) return;
      lastIndex = text.length;
      
      console.log('Solver Chunk:', newText);
      const lines = newText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('PROGRESS:')) {
          const msg = trimmed.replace('PROGRESS:', '').trim();
          onProgress?.(msg);
          showProgressNotification('Echo Solver (Remote)', msg);
        } else if (trimmed.startsWith('ERROR:')) {
          reject(new Error(trimmed.replace('ERROR:', '').trim()));
        } else if (trimmed.startsWith('RESULT:')) {
          try {
            const data = JSON.parse(trimmed.replace('RESULT:', '').trim());
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid JSON result from solver'));
          }
        }
      }
    };

    xhr.onprogress = () => processText(xhr.responseText);

    xhr.onload = () => {
      // Process any remaining text that might not have been caught by onprogress
      processText(xhr.responseText);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        // The promise might have already resolved in processText
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error || `Solver failed with status ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Solver failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error connecting to solver server. Check your Solver URL.'));
    };

    xhr.send(JSON.stringify({ prefix, target }));
  });
}

export async function publishLyrics(
  lrcText: string,
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number,
  userAgent: string,
  useRemoteSolver: boolean,
  solverUrl?: string,
  solverKey?: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
  powBatchSize: number = 50
) {
  const baseUrl = 'https://lrclib.net/api';

  try {
    if (signal?.aborted) throw new Error('Publish aborted');
    onProgress?.('Requesting challenge from LRCLIB...');
    await showProgressNotification('Echo Publisher', 'Requesting challenge from LRCLIB...');

    const challengeRes = await fetch(`${baseUrl}/request-challenge`, {
      method: 'POST',
      headers: { 'User-Agent': userAgent },
      signal,
    });

    if (!challengeRes.ok) {
      throw new Error(`Challenge request failed: ${challengeRes.statusText}`);
    }

    const challenge: ChallengeResponse = await challengeRes.json();
    
    let nonce: string;
    if (useRemoteSolver && solverUrl) {
      onProgress?.('Sending challenge to remote solver...');
      await showProgressNotification('Echo Publisher', 'Waiting for remote solver...');
      const solverData = await fetchRemoteSolver(
        solverUrl,
        solverKey || '',
        challenge.prefix,
        challenge.target,
        onProgress,
        signal
      );
      nonce = solverData.nonce;
      onProgress?.(`Remote solver finished in ${solverData.elapsed}s.`);
      await showProgressNotification('Echo Solver (Remote)', `Solved in ${solverData.elapsed}s!`, true);
    } else {
      onProgress?.('Solving Proof-of-Work challenge (Local)...');
      nonce = await solveChallenge(challenge.prefix, challenge.target, onProgress, signal, powBatchSize);
    }

    onProgress?.('Publishing lyrics to database...');
    await showProgressNotification('Echo Publisher', 'Finalizing upload to LRCLIB...');

    const durationSec = Math.max(1, Math.round(duration));
    const publishPayload = {
      trackName,
      artistName,
      albumName: albumName || '',
      duration: durationSec,
      lyrics: lrcText,
    };

    console.log('Publishing Payload:', JSON.stringify(publishPayload, null, 2));

    const publishRes = await fetch(`${baseUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Publish-Token': `${challenge.prefix}:${nonce}`,
      },
      body: JSON.stringify(publishPayload),
      signal,
    });

    if (!publishRes.ok) {
      let errorMsg = `Publish failed: ${publishRes.statusText}`;
      try {
        const errorData = await publishRes.json();
        console.error('LRCLIB Error Response:', errorData);
        errorMsg = errorData.message || errorMsg;
      } catch (e) {
        const text = await publishRes.text();
        console.error('LRCLIB Error Body (Text):', text);
      }
      
      await showProgressNotification('Echo Publisher', 'Failed to publish lyrics.', true);
      throw new Error(errorMsg);
    }

    const data = await publishRes.json();
    console.log('LRCLIB Success:', data);
    await showProgressNotification('Echo Publisher', 'Successfully published to LRCLIB!', true);
    return data;
  } catch (error: any) {
    console.error('LRCLIB Publish Error:', error);
    await showProgressNotification('Echo Publisher', `Error: ${error.message}`, true);
    throw error;
  }
}
