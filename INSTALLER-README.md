# Screens v0.9.0 — installer build kit

This archive is source code, not a compiled installer. The application code is unchanged from Screens v0.9.0. The package adds two ways to produce an Apple silicon DMG containing Screens.app and an Applications-folder shortcut.

## Option A — Build on a preparation Mac

1. Extract the ZIP. Install Node.js 22 or later from https://nodejs.org on the preparation Mac if needed. Internet access is required for the build.
2. Double-click `Build Screens Installer.command`. macOS may ask for permission to open the script. This opens Terminal automatically on the build Mac; no commands need to be typed.
3. The script installs the pinned dependencies, runs tests, and packages the existing application. If any step fails it stops and displays the error.
4. When the build succeeds, Finder opens `dist`. Transfer the `.dmg` to the church Mac.

## Option B — GitHub Actions (no local Terminal)

1. Create a private GitHub repository for Screens and upload the contents of the extracted project, including `.github/workflows/build-mac.yml` (hidden directories may need to be made visible; alternatively create the workflow file from GitHub's web editor).
2. Open the Actions tab, select **Build Screens for Mac**, and run the workflow if it has not already started on the main branch.
3. After a successful run, download the **Screens-Mac-Apple-Silicon** artifact. Extract the downloaded artifact ZIP to find the DMG.

## Install on the church Mac

Open the DMG, drag Screens into Applications, eject the DMG, and launch Screens from Applications. The target Mac does not require Node.js or Terminal. This build is not Developer ID signed/notarized; macOS may block it or require manual approval for trusted software. Follow your organization's security policy and Apple's guidance. Do not disable Gatekeeper globally. A properly signed and notarized distribution requires a Developer ID signing identity and notarization credentials.

Back up the previous library and validate display routing, launch restoration and a full service transfer before Saturday. No physical Mac or full interface testing was performed while preparing this build kit.
