# Changelog

All notable changes to Echo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.6] - 2026-04-21

### Added
- 20+ new Preset Themes based on Uncodixify palettes (Midnight, Obsidian, Slate, Carbon, Cloud, etc.)
- "Preset Themes" section in Appearance settings for quick theme selection

## [1.0.4.1-hotfix] - 2026-03-21
### Chore
- Added sed command to desktop.yml to replace baseUrl with " " as tauri serves it as root

## [1.0.4.1] - 2026-03-20

### Fixed
- Reanimated crash in color picker on Android when hex value is NaN
- Focus outline (white border) appearing on text areas on Web
- Version extraction logic in GitHub workflows to support hotfix tags (v1.x.x.x) and correctly match headers

### Added
- Mode toggle (Raw/Sync/Play) and editor actions (Reset, Share) to the top of the editor in Desktop Layout
- Tauri v2 initialization for desktop support (Windows & Linux)
- New `src-tauri/` directory with standard Tauri v2 configuration
- Automated icon generation step in `desktop.yml` workflow
- New desktop-first layout feature that can be toggled on/off by users
- Desktop layout provides side-by-side editor (60%) and player+controls (40%) arrangement
- `desktopMode` state added to AppSettingsContext for user preference persistence
- Settings toggle for Desktop Layout that only appears when build has `EXPO_PUBLIC_DESKTOP=true`

### Changed
- Refactored project structure: moved source code (`app`, `components`, `constants`, `context`, `lib`) to `src/` directory
- Optimized GitHub Action workflows by reordering `pnpm` installation to fix "pnpm not found" errors
- Updated `tsconfig.json` to reflect the new `src/` directory structure
- Improved asset path consistency for better compatibility across platforms
- Renamed `EXPO_PUBLIC_LAYOUTS_ENABLED` to `EXPO_PUBLIC_DESKTOP` in workflow files
- Removed all layout-related code and presets (side-by-side, editor-focused, player-focused, custom layouts)
- Simplified AppSettingsContext by removing layout configuration state
- Updated settings screen to only show Desktop Layout toggle when `EXPO_PUBLIC_DESKTOP` is true

### Removed
- `lib/layouts.tsx` - Complete layout system removed
- Layout picker modal from settings
- LayoutPreset type and related configuration

## [1.0.3] - 2026-01-15

### Added
- Custom theme maker with color picker
- Accent color picker modal
- Modern animations toggle with frosted glass effects
- Tutorial overlay system
- LRCLIB UP autofill hint modal
- Duration copy functionality for LRCLIB publishing

### Changed
- Improved playback rate selection grid
- Better search result badges for synced/plain lyrics
- Enhanced WebView integration for LRCLIB publishing

### Fixed
- Various bug fixes and improvements

## [1.0.2] - 2025-12-10

### Added
- Rhythm mode for syllable syncing
- Word-level timestamp editing
- Keyboard shortcuts for web (Space, Enter, Arrow keys)

### Changed
- Improved sync mode UX with FAB button
- Better timestamp pill styling
- Enhanced word chip UI

## [1.0.1] - 2025-11-20

### Added
- Multiple layout presets (default, side-by-side, editor-focused, player-focused, custom)
- Custom layout configuration
- Layout toggle in settings

### Fixed
- Auto-save functionality improvements

## [1.0.0] - 2025-10-15

### Added
- Initial release
- LRC file parsing and editing
- Audio playback with expo-av
- Lyric sync editor with tap-to-timestamp
- LRCLIB integration for lyric publishing
- LRCLIB search for importing existing lyrics
- Light/Dark/System theme support
- Accent color customization
- Pause on line end feature
- Offset adjustment for lyrics
- Share and export functionality
