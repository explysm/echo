import * as Crypto from 'expo-crypto';

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

interface ChallengeResponse {
  prefix: string;
  target: string;
}

async function solveChallenge(
  prefix: string, 
  target: string, 
  onProgress?: (msg: string) => void
): Promise<string> {
  let nonce = 0;
  const startTime = Date.now();
  const lowerTarget = target.toLowerCase();
  
  while (true) {
    // Perform 5000 hashes per batch to improve speed (expo-crypto is native)
    for (let i = 0; i < 5000; i++) {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        prefix + nonce
      );
      
      if (hash < lowerTarget) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Solved at nonce ${nonce} in ${totalTime}s`);
        return nonce.toString();
      }
      nonce++;
    }
    
    const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
    onProgress?.(`Solving PoW: nonce ${nonce} (${elapsedSecs}s elapsed)...`);
    
    // Minimal delay to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

export async function publishLyrics(
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number,
  lrcText: string,
  userAgent: string,
  onProgress?: (msg: string) => void
) {
  const baseUrl = 'https://lrclib.net/api';

  try {
    onProgress?.('Requesting challenge from LRCLIB...');
    const challengeRes = await fetch(`${baseUrl}/request-challenge`, {
      method: 'POST',
      headers: { 'User-Agent': userAgent },
    });

    if (!challengeRes.ok) {
      throw new Error(`Challenge request failed: ${challengeRes.statusText}`);
    }

    const challenge: ChallengeResponse = await challengeRes.json();
    
    onProgress?.('Solving Proof-of-Work challenge...');
    const nonce = await solveChallenge(challenge.prefix, challenge.target, onProgress);

    onProgress?.('Publishing lyrics to database...');
    const durationSec = Math.round(duration);
    const publishRes = await fetch(`${baseUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'X-Publish-Token': `${challenge.prefix}:${nonce}`,
      },
      body: JSON.stringify({
        trackName,
        artistName,
        albumName,
        duration: durationSec,
        lyrics: lrcText,
      }),
    });

    if (!publishRes.ok) {
      const errorData = await publishRes.json();
      throw new Error(errorData.message || `Publish failed: ${publishRes.statusText}`);
    }

    return await publishRes.json();
  } catch (error: any) {
    console.error('LRCLIB Publish Error:', error);
    throw error;
  }
}
