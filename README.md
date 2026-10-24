# D-Writing-Pad

An offline-friendly notepad. You can run it in a browser or build a standalone macOS or Windows app.

## Build the Mac app

The app bundle is built locally using the Swift compiler included with Xcode Command Line Tools; the full Xcode app is not required.

1. Install Node.js 22 or later and Xcode Command Line Tools.
2. Open Terminal in this folder.
3. Run `npm ci`.
4. Run `bash build-mac-app.sh`.
5. Share `dist/D-Writing-Pad.dmg` with your friend, or open `dist/D-Writing-Pad.app` directly.

The script builds a universal app for Intel and Apple Silicon Macs running macOS 13 or later, then packages it in a compressed DMG with an Applications shortcut. Open the DMG and drag the app to Applications to install it. The app has native menu-bar commands and Open and Save dialogs; the About menu shows **Version 1.0**. Notes are stored on this Mac in the app's preferences. This local build is ad-hoc signed and is not notarized, so macOS may show a security warning when friends open it. Public distribution without that warning requires signing and notarization with an Apple Developer ID.

The build script generates the offline formatter bundle, Manglish dictionary lookup, app's macOS icon (`AppIcon.icns`), and matching browser icon (`icon.png`). These generated files are not committed.

## Run it

1. Keep `index.html`, `styles.css`, `app.js`, `manglish.js`, `manglish-plugin.js`, and `manglish-dictionary.js` together in the same folder.
2. Double-click `index.html` to open Notepad in Safari, Chrome, or another browser.

## Use it

- The **+** at the end of the tab bar creates a new note. Notes are saved automatically in this browser on this Mac.
- **Open** opens one or more plain-text files (`.txt`, `.md`, or `.text`) as tabs.
- **Save as** downloads the current note as a `.txt` file you can keep or share.
- **Compare** lets you select two note tabs, edit both notes side by side, and saves edits automatically. Different lines are highlighted in both panes (left changes in red, right changes in green), and the highlights update as you edit.
- The top bar uses compact icons for Open, Save as, Compare, and text wrapping; hover over an icon to see its label. **Plugins** is labeled.
- **Wrap** controls whether long lines wrap at the edge of the editor.
- Enable **Manglish (Malayalam)** under **Plugins → Input Methods**, or press **⌘M** on Mac / **Ctrl+M** on Windows. The **മ** button appears only while Manglish is enabled; click it or use the same shortcut to turn Manglish off. Type a Romanized Malayalam word and press Space or punctuation to convert it to Malayalam script. The offline picker shows up to 10 matching dictionary words; if there are fewer, remaining choices are labeled **Letter** and offer alternate Malayalam letter/sound spellings. Choose by clicking, pressing **1–9** (or **0** for option 10), or using the arrow keys and Enter. Press **F2** to reopen choices for the last converted word.
- **A−** and **A+** decrease or increase the editor and comparison text size. The chosen size is remembered.
- Typing `(`, `[`, `{`, `"`, `'`, or a backtick automatically inserts its closing pair. Typing a closing character skips over its existing match; Backspace removes an empty pair.
- **Plugins** opens the plugin manager. It contains Manglish under Input Methods and available formatters such as JSON and YAML. Formatters validate the note before changing it; invalid input is left unchanged. Choose **Develop a plugin…** in the menu for an in-app guide and example.
- Double-click a tab name to rename it, or edit the note name above the editor.
- Use **⌘N** for a new note, **⌘O** to open files, **⌘S** to download the current note, and **⌘W** to close its tab.
- **⌘Tab** and **⌘⇧Tab** switch between note tabs.

When used in a browser, notes are stored in that browser's local storage. Clearing browser data can remove them, so use **Save as** for important copies. To prepare the generated files when opening the HTML directly, run `npm ci`, `npm run build:formatters`, and `npm run build:manglish-dictionary`.

Manglish suggestions use an offline Malayalam Hunspell wordlist from [Swathanthra Malayalam Computing](https://github.com/smc/smc/tree/master/spellcheck/hunspell-ml). Its source files and license notices are in `data/malayalam-hunspell/`; the browser-ready lookup file is `manglish-dictionary.js`. Regenerate that file after changing the source wordlist with `npm run build:manglish-dictionary`. The SMC wordlist is GPL-3.0-or-later; see the included `Copyright` and `GPL-3.0.txt` files. The Mac app bundle includes these notices and the source wordlist.

## GitHub builds and publishing changes

Every push to the `dev` branch runs the **Build macOS app** and **Build Windows app** workflows. Download the universal DMG or Windows installer/portable `.exe` from the relevant successful run under the repository's **Actions** tab (`D-Writing-Pad-macOS` or `D-Writing-Pad-Windows` artifact). You can also start either workflow manually from the Actions tab.

To run the Windows app locally for development, install Node.js 22 or later, then run `npm ci` and `npm run start:windows`. To build both Windows `.exe` packages locally from Windows, run `npm run build:windows`.

To publish stable downloads on the repository's **Releases** page, wait for both `dev` builds to succeed, download and extract their Actions artifacts, then choose **Releases → Draft a new release**. Create a version tag such as `v1.0.1` targeting `dev`, attach the `.dmg` and Windows `.exe` files (installer and portable build), add release notes, and publish. Actions artifacts are temporary build outputs; files attached to a published release are the lasting public downloads. Unsigned macOS and Windows apps may display operating-system security warnings.

Clone the existing `dev` branch (this avoids creating a branch before the repository has a commit):

```sh
git clone --branch dev https://github.com/dhaneshdlal/D-Writing-Pad.git
cd D-Writing-Pad
```

After making and testing changes, publish them to `dev`:

```sh
git add <files-you-changed>
git commit -m "Describe the change"
git push origin dev
```

Do not add generated build output (`.build/`, `dist/`, `node_modules/`, generated icons, or generated JavaScript bundles) to Git; `.gitignore` excludes these files.

### Plugin development

A plugin is a JavaScript file registered after `app.js` has loaded. Formatter plugins provide a unique `id`, a visible `name`, and a `format(content)` function that returns formatted text:

```js
window.NotepadPlugins.register({
  id: "trim-lines",
  name: "Trim each line",
  format(content) {
    return content
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  },
});
```

Input-method plugins provide `type: "input"` and `getSuggestions(word)`, returning choices with `kind`, `label`, and `value` properties. Selecting an input method in **Plugins** enables it; selecting it again disables it. Manglish is implemented this way in `manglish-plugin.js` and uses transliteration helpers from `manglish.js`.

Add a script tag after `app.js` in `index.html`, then reload the app. The plugin appears in the **Plugins** manager. Keep plugins local and review code before loading; plugin code runs with the same page permissions as the app. For a distributable Mac build, add the plugin file to the resource copy list in `build-mac-app.sh`.
