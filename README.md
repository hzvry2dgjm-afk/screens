# Screens 0.9

An early offline-first Mac presentation app for small churches. Black screens, white congregation lyrics, and stage lyrics with yellow upcoming text.

## Try the demo without installing anything

Open `index.html` in Chrome or Safari. The operator UI works in your browser and saves to browser local storage. Click **Displays** and **Open congregation** or **Open stage** to launch browser preview windows. Allow pop-ups when prompted. This demo is for learning the interface, not production projection.

## Run on a Mac

1. Install Node.js (version 22 or later).
2. Open Terminal in this project folder.
3. Run `npm ci` once (internet required for initial dependency installation).
4. Run `npm start` to launch the app.

## Transfer a service to another computer (v0.9)

1. On the preparation computer, build the service normally.
2. Open Service Library, enter the desired service name, and click **Export Current Service**. Saving a named service first is optional; the export includes the current working service.
3. Copy the resulting `.screens` file using AirDrop, a USB drive or a shared folder.
4. On the presentation Mac, open Screens → Service Library → **Import File**. Choose the file, approve the import, and choose whether to open it immediately. If you open it, the previous working service is preserved as a named saved service, and the imported service starts in blackout.
5. Verify the slides and arrangement, then restore screens when ready.

Other export options:
- Song Library or Slides Library → **Export** beside an item: exports the reusable song, scripture or announcement master.
- Service flow → **Export current presentation**: exports one service occurrence, including its arrangement, custom slides, slide edits, hidden slides and operator notes. Import it as a one-item service.
- Service Library → **Export** beside a saved service: exports that saved service snapshot.
- Service Library → **Export Entire Library**: includes all reusable songs and slides, all saved services and a snapshot of the working service. It merges into the receiving library rather than replacing it.

If an incoming ID matches an existing item with different content, the import preserves both versions and updates references to the imported version. Identical items sharing an ID are reused. Import never copies monitor mappings, clock settings, font preferences or live screen state; those remain local to each computer. This text-only transfer format does not include external media. Older full JSON backups are imported as library documents, not as destructive restores.

## Display setup (v0.8)

Connect three independent extended displays in macOS. Click **Displays → Identify** to see the corresponding screen numbers, choose Operator, Stage and Congregation, then click **Save & Apply**. The operator can be fullscreen or windowed; stage and congregation use borderless display-sized windows. Assignments and the stage clock are saved separately in `displays.json` in Electron's userData directory, leaving the original presentation database unchanged. With Restore outputs on launch enabled, the app reopens saved outputs automatically and starts in blackout; press B or Restore screens when ready. Missing outputs remain closed, and the operator falls back to the primary display. Reconnecting a recognized display restores its assigned output. If monitor identity is ambiguous, reassign manually. Electron display IDs and labels are not guaranteed permanent, especially with identical displays or adapters. Do not rely on this feature until tested with your actual cabling.

The stage clock is visible by default and can be hidden, aligned left/center/right, resized, switched between 12/24-hour time, and configured to show seconds. Clock settings save immediately. Use Windowed previews for testing (in the browser, physical display setup is not supported).

## Announcements

Choose **Add Announcement** in the service sidebar or create a custom slide in the Slides Library. Enter a library title and the text to display; separate blocks with a blank line to create multiple slides. If text is empty, the title is displayed. Announcements are reusable from the Slides Library and use the existing black-and-white slide renderer and editing tools. Service-specific edits remain local to the service occurrence.

## Upgrade and verification

Back up the existing library using the previous version’s Service Library → Export Backup before upgrading. Screens automatically copies presentation.json and displays.json from the first detected legacy Worship Presenter data directory into a new, unused Screens data directory, leaving the original files unchanged. If both versions of the old data folder exist, verify the imported library; alternatively import your explicit backup. This is a source distribution, not a signed or notarized Mac installer. Run `npm install`, `npm test`, then `npm start` on your Mac. Verify all three displays, restart restoration, monitor disconnect/reconnect, blackout, and clock behavior in rehearsal before production use. The pure Node tests were run in the build environment; Electron hardware testing and jsdom UI tests require installed dependencies.

## Controls

- **Right arrow** or **Space**: next slide
- **Left arrow**: previous slide
- **B**: blackout / restore
- Click a slide thumbnail to jump immediately.
- Keyboard shortcuts are ignored while typing in fields.

## Build a song

Click **+** in the service sidebar to open **Add New Song**, enter a title, paste lyrics with `[Verse 1]`, `[Chorus]`, etc., choose one or two lines per slide, and save. The builder closes when you're done, leaving the right sidebar for the live service flow. Click section chips to append sections to an arrangement; drag the colored group chips to reorder them or click one to jump to that group. Verse groups are yellow, choruses orange, bridges teal. Toggle **ALL CAPS** from the top bar. The stage output shows the current slide in large white text and the next slide in smaller yellow text below it. Long lyric lines shrink to preserve the intended number of lines. Everything saves to the Mac's app data directory.

## Add Scripture

Click **+ Add Scripture** at the bottom of the service sidebar. Enter a reference or title and paste the passage. The app detects verse numbers and starts with the whole pasted passage on **one slide**. Use **Edit Slides** to split it into additional slides or customize the wording and line breaks. No API or translation selector is involved. Make sure you have permission to use the text you import.

## Edit Slides

Choose a song or scripture item and click **Edit Slides**. A large editor opens with a scrollable slide list, full-size preview and text area. Select any thumbnail or use Previous / Next to navigate without closing the editor. Text edits autosave to the current service item. Place the caret between two portions of text and click **Split at cursor** to create another slide; **Reset this slide** restores its original text. Edits are specific to the selected occurrence in the service, not the underlying song library.

## Hide slides

Click the eye control on each slide thumbnail to exclude it from projection without deleting it; click again to restore. Use **Hide slide grid** to collapse the entire thumbnail area. Section colors are also visible around slide thumbnails.

## Service dividers

Use **+ Add Divider** in the sidebar to create operator-only headers such as Worship, Scripture, Message, or Response. Insert before/after the current service item or at the end. Rename or remove headers in the sidebar. Navigation skips dividers automatically, and they never appear on the output screens.

## Service and Library workflow (v0.7)

- Drag songs, scripture items, and dividers in the service sidebar to rearrange the order. A highlighted target shows the drop location.
- The sidebar groups **New Song**, **Song Library**, **Slides Library**, **Add Scripture**, and **Add Divider** together. Song Library excludes scripture and custom slides; Slides Library contains those items instead.
- Library deletion requires **two confirmations** and removes service references to the deleted item, including in saved service snapshots. Export a backup first if the material matters.
- Click **Service Library** to name and save an entire service, duplicate it, open saved versions, or begin a blank service. Export and import a portable .screens file; older JSON backups are supported.
- Click **⌘K Search** to find library items quickly and jump to those already in the service or add missing ones.
- **Undo / Redo** are available in the toolbar or with `⌘Z` and `⌘⇧Z`. Recent local state is tracked for up to 100 changes. Export backups before major reorganization.
- **Aa Fonts** controls separate congregation, stage-current, and stage-next font sizes and their weight. These settings persist.
- The stage screen's **UP NEXT** area shows only the **first line** of the next slide in larger yellow text.

## Extended Slide Editor (v0.7)

Alongside text edits, the full-size slide editor now supports **Delete Slide** (recover with Undo), **Duplicate**, **Blank Slide**, **drag to reorder**, and **operator-only notes**. Slide deletions affect the selected service occurrence and do not erase the library master.

## Long lyrics and passages

New songs and scripture are automatically wrapped at word boundaries into readable lines before slide creation. Earlier saved imports are re-paginated when the updated app opens. The stage screen includes an **UP NEXT · VERSE / CHORUS / BRIDGE / SCRIPTURE** header above the smaller yellow upcoming lyrics.

## Create a Mac installer

On a Mac, run `npm run dist:mac` after installing dependencies. Build artifacts appear in `dist/`. The included build configuration creates an unsigned Apple silicon build; macOS may require explicit approval in Privacy & Security after you verify the locally built app. Do not disable Gatekeeper globally. A signed/notarized distribution build requires an Apple Developer account.

## Current foundation limitations

- No bundled scripture translation, scripture browser, or external song imports yet.
- Arrangement editing is local to a service item; an arrangement library is next.
- The interface currently supports keyboard defaults; hotkey remapping is next.
- No automated hardware-output validation has been performed on a multi-monitor Mac.
- A single physical display cannot host two simultaneous fullscreen outputs; windowed previews are provided for testing.
