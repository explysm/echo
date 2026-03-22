export interface Syllable {
  time: number;
  text: string;
}

export interface LyricLine {
  id: string;
  start: number;
  end: number | null;
  text: string;
  syllables?: Syllable[];
  position?: 'left' | 'center' | 'right' | string;
}

export function formatLyricsToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .map((line) => {
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
      };

      let lineLRC = `[${formatTime(line.start)}] `;

      if (line.position && line.position !== 'center') {
        lineLRC += `{@position:${line.position}} `;
      }

      if (line.syllables && line.syllables.length > 0) {
        lineLRC += line.syllables
          .map((s) => {
            // Every word in an enhanced line MUST have a tag to prevent the parser 
            // from combining them. If desynced, use the line's start time.
            const t = s.time > 0 ? s.time : line.start;
            return `<${formatTime(t)}> ${s.text.trim()}`;
          })
          .join(' ');
      } else {
        lineLRC += line.text.trim();
      }

      return lineLRC.trim();
    })
    .join('\n');
}

export function parseLRCToLyrics(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const lyrics: LyricLine[] = [];
  
  // Regex to match [mm:ss.xx] and optional {@position:xxx} and content
  const lineRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;
  const positionRegex = /\{@position:([^}]+)\}/;
  const syllableRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]*)/g;

  lines.forEach((line) => {
    const match = line.match(lineRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const start = minutes * 60 + seconds + centiseconds / 100;
      let content = match[4].trim();

      // Extract Position
      let position: string | undefined;
      const posMatch = content.match(positionRegex);
      if (posMatch) {
        position = posMatch[1];
        content = content.replace(positionRegex, '').trim();
      }

      // Extract Syllables
      const syllables: Syllable[] = [];
      let syllableMatch;
      const originalContent = content;
      
      while ((syllableMatch = syllableRegex.exec(originalContent)) !== null) {
        const sMins = parseInt(syllableMatch[1], 10);
        const sSecs = parseInt(syllableMatch[2], 10);
        const sCents = parseInt(syllableMatch[3], 10);
        const sTime = sMins * 60 + sSecs + sCents / 100;
        const sText = syllableMatch[4].trim();
        
        // If the syllable time is exactly the same as the line start, 
        // treat it as "desynced" (time: 0) for the UI.
        // This is necessary because formatLyricsToLRC uses the line start
        // as a placeholder to keep words separate.
        const effectiveTime = sTime === start ? 0 : sTime;
        
        syllables.push({ time: effectiveTime, text: sText });
      }

      // If syllables exist, rebuild plain text
      const plainText = syllables.length > 0 
        ? syllables.map(s => s.text).join(' ')
        : content;

      lyrics.push({
        id: `line-${start.toFixed(3)}`,
        start,
        end: null,
        text: plainText,
        syllables: syllables.length > 0 ? syllables : undefined,
        position,
      });
    }
  });

  lyrics.sort((a, b) => a.start - b.start);
  for (let i = 0; i < lyrics.length - 1; i++) {
    lyrics[i].end = lyrics[i + 1].start;
  }

  return lyrics;
}

/**
 * Checks if the lyrics string is "synced" (contains LRC timestamps).
 */
export function isSynced(lrc: string): boolean {
  return /\[\d{2}:\d{2}\.\d{2,3}\]/.test(lrc);
}

function formatTimeSRT(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatTimeVTT(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function formatLyricsToSRT(lyrics: LyricLine[]): string {
  return lyrics
    .map((line, index) => {
      const start = formatTimeSRT(line.start);
      const end = line.end !== null ? formatTimeSRT(line.end) : formatTimeSRT(line.start + 5);
      const text = line.text.trim().replace(/<\/?[^>]+(>|$)/g, '');
      return `${index + 1}\n${start} --> ${end}\n${text}`;
    })
    .join('\n\n');
}

export function formatLyricsToVTT(lyrics: LyricLine[]): string {
  const header = 'WEBVTT\n\n';
  const cues = lyrics
    .map((line) => {
      const start = formatTimeVTT(line.start);
      const end = line.end !== null ? formatTimeVTT(line.end) : formatTimeVTT(line.start + 5);
      const text = line.text.trim().replace(/<\/?[^>]+(>|$)/g, '');
      return `${start} --> ${end}\n${text}`;
    })
    .join('\n\n');
  return header + cues;
}
