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
  signal?: AbortSignal
): Promise<string> {
  let nonce = 0;
  const startTime = Date.now();
  const lowerTarget = target.toLowerCase();
  
  while (true) {
    if (signal?.aborted) throw new Error('Solver aborted');

    // Perform 10000 hashes per batch to significantly improve speed
    for (let i = 0; i < 10000; i++) {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        prefix + nonce
      );
      
      if (hash < lowerTarget) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Solved at nonce ${nonce} in ${totalTime}s`);
        await showProgressNotification('Echo Solver', `Solved at nonce ${nonce}!`, true);
        return nonce.toString();
      }
      nonce++;
    }
    
    const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
    const hashesPerSec = Math.floor(nonce / elapsedSecs || 0);
    const msg = `Solving PoW: nonce ${nonce} (${hashesPerSec} H/s)...`;
    onProgress?.(msg);
    
    // Update notification every 100k nonces
    if (nonce % 100000 === 0) {
      await showProgressNotification('Echo Solver (Local)', msg);
    }
    
    // Minimal delay to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
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
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${url}/solve`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-solver-key', key || '');

    if (signal) {
      signal.onabort = () => {
        xhr.abort();
        reject(new Error('Solver aborted'));
      };
    }

    let lastIndex = 0;

    xhr.onprogress = () => {
      const newText = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      
      console.log('Solver Chunk:', newText);
      const lines = newText.split('\n');
      for (const line of lines) {
        if (line.startsWith('PROGRESS:')) {
          const msg = line.replace('PROGRESS:', '').trim();
          onProgress?.(msg);
          showProgressNotification('Echo Solver (Remote)', msg);
        } else if (line.startsWith('ERROR:')) {
          reject(new Error(line.replace('ERROR:', '').trim()));
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Look for the RESULT line in the full response
        const lines = xhr.responseText.split('\n');
        for (const line of lines) {
          if (line.startsWith('RESULT:')) {
            try {
              const data = JSON.parse(line.replace('RESULT:', '').trim());
              resolve(data);
              return;
            } catch (e) {
              reject(new Error('Invalid JSON result from solver'));
              return;
            }
          }
        }
        reject(new Error('Solver finished without a result line'));
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
      reject(new Error('Network error connecting to solver server'));
    };

    xhr.send(JSON.stringify({ prefix, target }));
  });
}

export async function publishLyrics(
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number,
  lrcText: string,
  userAgent: string,
  useRemoteSolver?: boolean,
  solverUrl?: string,
  solverKey?: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
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
      nonce = await solveChallenge(challenge.prefix, challenge.target, onProgress, signal);
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
