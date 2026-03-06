# <img src="public/echo.png" width="48" height="48" align="center" /> Echo

Echo is a minimalist, open-source lyric editor built with Expo and TypeScript. It is designed specifically for creating, syncing, and publishing time-tagged lyrics to [LRCLIB](https://lrclib.net/).

> [!IMPORTANT]
> **Early Access**: Echo is currently in early access. You may encounter bugs, and features are subject to change. Contributions and feedback are highly appreciated!

## Features

-   **Audio Engine**: Load local MP3 files with full playback control (Play/Pause, Stop, Seek).
-   **Dual-Mode Editor**:
    -   **Raw Mode**: Edit LRC or plain text directly in a powerful text input.
    -   **Sync Mode**: Use the specialized "Echo Sync" FAB to capture precise start and end times for each line.
-   **LRCLIB Integration**: Publish your synced lyrics directly to LRCLIB with built-in Proof-of-Work (PoW) challenge solving.
-   **Minimalist Design**: Sleek Slate-based UI with full support for Light and Dark modes.
- **Customizable**: Configure your User-Agent to comply with LRCLIB's API guidelines.
- **Remote Solver Support**: Speed up the publishing process by using an optional Node.js server to solve Proof-of-Work challenges.

## Remote Solver Setup (Optional)

To speed up the PoW challenge solving (which can be slow on mobile JS), you can deploy the included solver server.

### 1. Deploy the Server
1. The solver code is located in the `server/` directory.
2. Deploy it to a service like [Render](https://render.com/) or [Vercel](https://vercel.com/).
3. Set an environment variable on your hosting provider: `SOLVER_KEY=your_secret_key_here`.
4. **24/7 Hosting (Render Free Tier):** To prevent your Render service from spinning down, use a service like [UptimeRobot](https://uptimerobot.com/) to ping your server's `/health` endpoint (e.g., `https://my-solver.onrender.com/health`) every 5 minutes.

### 2. Configure the App
#### For Development/Personal Use:
Go to the **Settings** tab in the app and enter:
- **Solver URL**: Your deployed server URL (e.g., `https://my-solver.onrender.com`).
- **Solver Key**: The same secret key you set in step 1.

#### For Automated Builds (GitHub Actions):
Set these **Repository Secrets** in GitHub (Settings > Secrets and variables > Actions):
- `SOLVER_URL`: Your solver's URL.
- `SOLVER_KEY`: Your secret key.

These will be automatically injected as `EXPO_PUBLIC_SOLVER_URL` and `EXPO_PUBLIC_SOLVER_KEY` during the Android build and GitHub Pages deployment.

## Deployment

### Android (APK)
The project includes a GitHub Workflow that automatically builds a debug APK on every push to `main`. You can find the APKs in the **Actions** tab under the latest run.

### Web (GitHub Pages)
This app is fully compatible with GitHub Pages. On every push to `main`, it automatically builds and deploys the web version.
1. Go to your repository **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **"GitHub Actions"**.
3. The app will be live at `https://<your-username>.github.io/echo/`.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v20 or newer)
-   [pnpm](https://pnpm.io/)
-   [Expo Go](https://expo.dev/go) on your mobile device (for development)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/sudoloser/echo.git
    cd echo
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Start the development server:
    ```bash
    pnpm start
    ```

4.  Open the app in Expo Go by scanning the QR code in your terminal.

## Building for Android

The project includes a GitHub Workflow that automatically builds a debug APK on every push to `main`. You can also build locally using:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the MIT License - see the LICENSE file for details (if applicable).
