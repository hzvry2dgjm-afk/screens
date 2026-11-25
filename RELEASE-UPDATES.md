# Screens 0.9.1 — update distribution

Build on your Mac using Build Screens Installer.command. Back up the current library with Service Library > Export Entire Library first. Install the DMG over the existing Screens.app with Screens closed. The application ID and userData path remain unchanged.

## First GitHub upload
The public repository is https://github.com/hzvry2dgjm-afk/screens. From this extracted source directory, after reviewing the files and ensuring GitHub authentication, run:

```sh
git init -b main
git add .
git commit -m 'Screens 0.9.1 update notifications'
git remote add origin https://github.com/hzvry2dgjm-afk/screens.git
git push -u origin main
git tag v0.9.1
git push origin v0.9.1
```

If the repo already has commits, clone it and copy the reviewed files instead; do not force push. GitHub Actions must be enabled, and your credential must allow workflow file changes. See the Actions tab for results. A version tag triggers both architecture builds and creates a draft release. Test the downloaded DMGs before publishing the draft. The app checks published stable releases only, and requires an exact architecture-matched asset named Screens-VERSION-arm64.dmg or Screens-VERSION-x64.dmg. Future releases: increment the package.json and package-lock.json root versions, commit and push, then tag the matching version and push the tag. Keep the previous release available for rollback.

## Operator updates
On launch Screens checks GitHub in the background. A passive operator toolbar button and Updates menu indicate a compatible release. With output in blackout, click the button or Updates > Check for Updates, review notes, choose Back Up & Download. Screens copies the saved presentation and display files into its userData/update-backups directory and opens the official GitHub DMG download. Wait until after service, quit Screens, replace the app in Applications and reopen. No automatic installation, forced restart or bypass of macOS security is implemented. The backup captures saved on-disk data; export the current library as an additional precaution. Use Previous Releases to download an older version and keep an external backup before rollback. Unsigned builds may require macOS approval. Do not bypass a malware detection warning.

No compiled Mac installer is included in this source kit. The CI workflow and Mac UI must be tested on macOS before live use.
