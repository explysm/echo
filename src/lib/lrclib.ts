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
  speaker?: string; // e.g. "v1", "v2"
  isBackground?: boolean;
}

export function formatLyricsToLRC(lyrics: LyricLine[]): string {
  return lyrics
    .filter(line => line.start >= 0)
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

      if (line.speaker) {
        lineLRC += `${line.speaker}: `;
      }

      let content = '';
      if (line.syllables && line.syllables.length > 0) {
        content = line.syllables
          .map((s) => {
            const t = s.time > 0 ? s.time : line.start;
            return `<${formatTime(t)}> ${s.text.trim()}`;
          })
          .join(' ');
      } else {
        content = line.text.trim();
      }

      if (line.isBackground) {
        lineLRC += `[bg:${content}]`;
      } else {
        lineLRC += content;
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
  const speakerRegex = /^([a-zA-Z0-9]+):\s*(.*)$/;
  const backgroundRegex = /\[bg:([^\]]+)\]/;

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

      // Extract Background
      let isBackground = false;
      const bgMatch = content.match(backgroundRegex);
      if (bgMatch) {
        isBackground = true;
        content = bgMatch[1].trim(); // Extract content from inside [bg:]
      }

      // Extract Speaker
      let speaker: string | undefined;
      const speakerMatch = content.match(speakerRegex);
      if (speakerMatch) {
        speaker = speakerMatch[1];
        content = speakerMatch[2].trim();
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
        
        const effectiveTime = sTime === start ? 0 : sTime;
        syllables.push({ time: effectiveTime, text: sText });
      }

      // If syllables exist, rebuild plain text
      const plainText = syllables.length > 0 
        ? syllables.map(s => s.text).join(' ')
        : content;

      lyrics.push({
        id: Math.random().toString(36).substr(2, 9),
        start,
        end: null,
        text: plainText,
        syllables: syllables.length > 0 ? syllables : undefined,
        position,
        speaker,
        isBackground,
      });
    } else if (line.trim()) {
      // Handle plain text line
      let text = line.trim();
      
      // Try to parse speaker/bg even in plain text
      let speaker: string | undefined;
      let isBackground = false;
      
      const bgMatch = text.match(backgroundRegex);
      if (bgMatch) {
        isBackground = true;
        text = bgMatch[1].trim();
      }
      
      const speakerMatch = text.match(speakerRegex);
      if (speakerMatch) {
        speaker = speakerMatch[1];
        text = speakerMatch[2].trim();
      }

      lyrics.push({
        id: Math.random().toString(36).substr(2, 9),
        start: -1,
        end: null,
        text,
        speaker,
        isBackground,
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
