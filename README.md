# NetMD

**NetMD** is a lightweight, privacy-focused Chrome Extension (or local web app) that converts Markdown to PDF/Print locally. It functions entirely offline, ensuring no data leaves your machine.

## Features
- **Local & Offline**: Zero external requests during runtime. All libraries (`marked`, `prismjs`, `dompurify`) are bundled in `/lib`.
- **Live Preview**: Real-time rendering of Markdown as you type.
- **Syntax Highlighting**: Code blocks are automatically highlighted using PrismJS.
- **Advanced Theming**: Switch between "GitHub", "Notion", and "Academic" styles. Includes a built-in CSS editor to override themes locally.
- **Smart Printing**: Optimized CSS for printing (`break-inside: avoid` for code blocks, hidden UI elements).
- **Sanitized Output**: Uses DOMPurify to prevent XSS while allowing rich HTML functionality.

## Project Structure
- `manifest.json`: Chrome Extension manifest (MV3).
- `src/`: Main source code.
    - `index.html`: The entry point (Popup UI).
    - `js/script.js`: Core logic.
    - `css/styles.css`: UI styles.
    - `themes/`: CSS themes for the editor.
- `assets/icons/`: Extension icons.
- `docs/`: Supplementary documentation.
    - `example.md`: A comprehensive Markdown test file.
- `lib/`: Vendored dependencies (generated).
- `scripts/`: Development scripts (e.g., `vendor.js`).

## Quick Start
You can test the renderer by copying the content from [docs/example.md](docs/example.md) into the editor. It covers all supported Markdown elements and syntax highlighting.

## Dependency Management

This project uses a "vendoring" approach. We use `package.json` to define dependency versions, but we copy the actual library files to the `/lib` folder so the app runs without a build step or `node_modules`.

### How to Update Dependencies

You DO NOT need Node.js installed locally to update dependencies. We use Docker to handle the download and copying process.

#### Option 1: Docker (Recommended / Cross-Platform)
Execute this in your terminal to automatically update all libraries:

```bash
docker run --rm -v ${PWD}:/app -w /app node:24-alpine sh -c "npm install && npm run vendor"
```
*Note: On Linux/Mac, replace `${PWD}` with `$(pwd)`.*

#### Option 2: PowerShell Script (Windows Shortcut)
If you are on Windows, you can use the included wrapper:
```powershell
.\docker_install.ps1
```

#### Option 3: Local Node.js
If you have Node.js (v24 LTS recommended) installed locally:
```bash
npm install
npm run vendor
```

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Styling
The project uses **Tailwind CSS** (via a standalone file in `/lib`) for the UI layout, and standard CSS (`styles.css` / `/themes`) for the markdown content.
