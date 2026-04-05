# Echo - Minimalist Lyric Editor

<div style="background: #222; color: #ff4444; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center; font-weight: bold; border: 2px solid #ff4444;">
  <a href="https://keepandroidopen.org/" style="color: #ffdd44; text-decoration: underline;">
    Keep Android Open
  </a>
  – No paid registration, no government ID, no Google gatekeeping for Android developers.<br>
  Android will become locked down in \~170 days. Sign the letter →
  <a href="https://keepandroidopen.org/open-letter" style="color: #ffdd44;">open letter</a>
</div>
<br>

> [!IMPORTANT]
> **Early Access**: This project is currently in early access. You may encounter bugs or incomplete features. Please report any issues you find!

Echo is a minimalist, open-source lyric editor built with Expo and TypeScript, designed specifically for syncing and publishing lyrics to [LRCLIB](https://lrclib.net/).

## Features
- **Minimalist UI**: Focused on the core task of lyric editing and syncing.
- **Sync Editor**: Easy-to-use interface for adding timestamps to plain text lyrics.
- **Real-time Player**: Preview your synced lyrics with the built-in audio player.
- **Instant Upload**: Submit your lyrics to LRCLIB via the integrated [LRCLIB UP](https://lrclibup.boidu.dev/) interface.
- **Export to .lrc**: Save your work locally as standard LRC files.
- **Cross-Platform**: Works as an Android APK, Windows EXE (setup) and through the [website.](https://explysm.github.io/echo)

## Screenshots
<p align="center">
  <img src="assets/images/echo-ss-1.png" width="45%" />
  <img src="assets/images/echo-ss-2.png" width="45%" />
</p>

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/explysm/echo.git
   cd echo
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start the development server**:
   ```bash
   npx expo start
   ```

## Install

### Android APK
Download the latest APK from the [Releases](https://github.com/explysm/echo/releases) page.

### Desktop (Windows)
- **Windows**: Download `Echo_x.x.x_x64-setup.exe` from the [Releases](https://github.com/explysm/echo/releases) page.

### Web (PWA)
Access the web version at: https://explysm.github.io/echo

## Building & Releasing

> [!NOTE]
> **Versioning**: Bug fix releases (e.g. `v1.0.0` → `v1.0.0.1`) do not bump the app version in `app.json`, `.public-env`, or `package.json`. Only feature releases that introduce new functionality bump the app version.

### Android APK
The project includes a GitHub Workflow for building the release APK. To use it:
1. Set up the following secrets in your GitHub repository:
   - `KEYSTORE`: Base64 encoded keystore file.
   - `KEYSTORE_PASS`: Password for the keystore.
   - `KEY_ALIAS`: Alias for the key.
   - `KEY_PASS`: Password for the key.
2. Push a tag starting with `v` (e.g., `v1.1.0`) to trigger the build and release.

### GitHub Pages (Web)
The web version is automatically deployed to GitHub Pages whenever you push to the `main` branch.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request or open an issue.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
