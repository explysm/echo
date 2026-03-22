## [1.0.5] - 2026-03-22

### Fixed
- MP3 audio playback on desktop (Linux) using Blob URL conversion via Tauri's `convertFileSrc` API (alternative to Rust HTTP server)
- Desktop Layout toggle now works on web AND desktop (previously only desktop build, now also web with width >= 768px)
- Mode toggle pill with animated indicator

### Added
- `src/lib/audioUtils.ts` module for desktop audio file handling with Blob URL conversion
- `@tauri-apps/api` dependency for desktop file handling
- Drag & drop support for audio files (.mp3, .wav, .ogg, .m4a, .flac, .aac) and LRC files on web/desktop
- `DropZone` component for file drag & drop
- `ShortcutsModal` component for displaying keyboard shortcuts (desktop/web only)
- Export formats: LRC, SRT, and VTT support with format dropdown
- Settings page enhanced with app features list and version badge
- Tabbed layout only shows when Desktop Layout toggle is enabled and screen width >=768px
- Version 1.0.5 (updated in app.json, .public-env, package.json)

### Changed
- Share modal now shows format selection step before exporting
- Pick audio function uses audioUtils for proper desktop audio handling
- Desktop Layout now available on web AND desktop when screen width >=768px
