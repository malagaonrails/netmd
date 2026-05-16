
// Initialize libraries
let editor, preview, printBtn;
let themeSelect, editThemeBtn, baseThemeLink, themeOverride;
let cssModal, cssEditor, closeCssModal, cancelCssBtn, saveCssBtn, resetCssBtn;

// State
let currentTheme = 'github';
let currentThemeRawCss = ''; // Store raw CSS for editing if available

// Configure Marked to use Prism for highlighting
if (typeof marked !== 'undefined') {
    marked.setOptions({
        highlight: function (code, lang) {
            if (typeof Prism !== 'undefined' && Prism.languages[lang]) {
                return Prism.highlight(code, Prism.languages[lang], lang);
            } else {
                return code;
            }
        },
        breaks: true,
        gfm: true
    });
}

// Main render function
function updatePreview() {
    if (!editor || !preview) return;
    if (typeof marked === 'undefined') {
        preview.innerHTML = "<p style='color:red'>Error: Marked.js library not loaded.</p>";
        return;
    }

    try {
        const rawMarkdown = editor.value;
        const rawHtml = marked.parse(rawMarkdown);

        let cleanHtml = rawHtml;
        if (typeof DOMPurify !== 'undefined') {
            cleanHtml = DOMPurify.sanitize(rawHtml, {
                USE_PROFILES: { html: true },
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
            });
        }

        preview.innerHTML = cleanHtml;
        updateTitle(rawMarkdown);
    } catch (e) {
        console.error("Render Error:", e);
    }
}

/**
 * Updates the document title based on markdown content
 * @param {string} markdown 
 */
function updateTitle(markdown) {
    const defaultTitle = "NetMD - Local Markdown to PDF / Print converter";
    if (!markdown || !markdown.trim()) {
        document.title = defaultTitle;
        return;
    }

    // Get first line with content
    const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || "";

    let clean = "";
    try {
        if (typeof marked !== 'undefined') {
            // 1. Parse markdown line to HTML
            const html = marked.parse(firstLine);
            
            if (typeof DOMPurify !== 'undefined') {
                // 2. Use DOMPurify to securely extract text content via DOM fragment
                const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
                clean = fragment.textContent || "";
            } else {
                // Fallback: simple tag stripping if DOMPurify is missing
                clean = html.replace(/<[^>]*>/g, "");
            }
        }
    } catch (e) {
        console.error("Title Extraction Error:", e);
    }

    // Clean up whitespace/newlines and fallback to raw line if result is empty
    clean = (clean || firstLine.replace(/^[#\s*>-]+/g, '')).trim();

    if (!clean) {
        document.title = defaultTitle;
        return;
    }

    if (clean.length > 50) {
        clean = clean.substring(0, 47) + "...";
    }

    document.title = `NetMD - ${clean}`;
}

// ... (Theme Manager functions loadTheme, openCssEditor, etc are unchanged, skipping rewrite for brevity unless requested) ... 
// IMPORTANT: We need to make sure we don't accidentally check undefined vars in the other functions.
// But since they are triggered by events, they will run AFTER DOMContentLoaded anyway.

/* =========================================
   NOTE: THEME MANAGER FUNCTIONS ARE PRESERVED 
   (They reference the global 'let' variables defined above)
   ========================================= */

// Event Listeners (wrapped in DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded - identifying elements...");

    // Select Elements
    editor = document.getElementById('editor');
    preview = document.getElementById('preview');
    printBtn = document.getElementById('printBtn');
    themeSelect = document.getElementById('themeSelect');
    editThemeBtn = document.getElementById('editThemeBtn');
    baseThemeLink = document.getElementById('base-theme-link');
    themeOverride = document.getElementById('theme-override-style');
    cssModal = document.getElementById('cssEditorModal');
    cssEditor = document.getElementById('cssEditor');
    closeCssModal = document.getElementById('closeCssModal');
    cancelCssBtn = document.getElementById('cancelCssBtn');
    saveCssBtn = document.getElementById('saveCssBtn');
    resetCssBtn = document.getElementById('resetCssBtn');

    // Attach Listeners
    if (editor) editor.addEventListener('input', updatePreview);
    if (printBtn) printBtn.addEventListener('click', () => { window.print(); });

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            loadTheme(e.target.value);
        });
    }

    if (editThemeBtn) editThemeBtn.addEventListener('click', openCssEditor);
    if (closeCssModal) closeCssModal.addEventListener('click', closeEditor);
    if (cancelCssBtn) cancelCssBtn.addEventListener('click', closeEditor);
    if (saveCssBtn) saveCssBtn.addEventListener('click', saveCss);

    if (resetCssBtn) {
        resetCssBtn.addEventListener('click', resetCss);
        console.log("Reset Button Listener Attached");
    } else {
        console.error("Reset Button NOT FOUND in DOM");
    }

    if (cssModal) {
        cssModal.addEventListener('click', (e) => {
            if (e.target === cssModal) closeEditor();
        });
    }

    // Initial Render
    // Initial Render
    if (editor) {
        // editor.value = defaultText; // Removed as requested
        updatePreview();
    } else {
        console.error("CRITICAL: Editor element not found!");
    }

    // Initialize Theme
    try {
        loadTheme('github');
    } catch (e) {
        console.error("Theme Init Error:", e);
    }

    // Secure Link Behavior
    if (typeof DOMPurify !== 'undefined') {
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if ('target' in node) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }

    console.log("NetMD Initialized");
});

/* =========================================
   THEME MANAGER (ROBUST HYBRID MODE)
   ========================================= */

async function loadTheme(themeName) {
    currentTheme = themeName;
    const savedCss = localStorage.getItem(`netmd_theme_${themeName}`);

    // We try to determine if we are in "Full Control" mode (Fetch works) 
    // or "Fallback" mode (CORS blocked, use <link>).

    let fetchSuccess = false;
    let fetchedContent = '';
    // 2. Try to Fetch for editing capability (Extension Mode / Web Server)
    if (location.protocol !== 'file:') {
        try {
            const res = await fetch(`themes/${themeName}.css`);
            if (res.ok) {
                fetchedContent = await res.text();
                fetchSuccess = true;
            }
        } catch (e) {
            // CORS or Network error -> Fallback mode
            fetchSuccess = false;
        }
    }

    if (fetchSuccess) {
        // MODE A: Full Control (Extension or Localhost)
        // We have the source. We use <style> tag exclusively.
        console.log(`[Theme] Mode: Full Control (${themeName})`);

        baseThemeLink.href = ''; // Disable fallback link

        if (savedCss) {
            // User has a saved version (Full Replacement)
            themeOverride.textContent = savedCss;
            currentThemeRawCss = savedCss;
        } else {
            // Use original fetched content
            themeOverride.textContent = fetchedContent;
            currentThemeRawCss = fetchedContent;
        }

    } else {
        // MODE B: Fallback (file:// protocol)
        // We cannot read source. We use <link> for base, <style> for override.
        console.log(`[Theme] Mode: Fallback (${themeName})`);

        baseThemeLink.href = `themes/${themeName}.css`; // Enable base link

        if (savedCss) {
            // User has saved OVERRIDES only
            themeOverride.textContent = savedCss;
            currentThemeRawCss = ''; // We don't have full source, forcing "Override" view in editor
        } else {
            themeOverride.textContent = '';
            currentThemeRawCss = '';
        }
    }
}

function openCssEditor() {
    // If we have content (Fetch succeeded OR In Extension Mode), show it
    if (currentThemeRawCss) {
        cssEditor.value = currentThemeRawCss;
        cssEditor.disabled = false;
        cssEditor.placeholder = "";
    } else {
        // Fallback Mode: We check if there's already an existing override in the style tag
        const currentOverride = themeOverride.textContent;
        const placeholder = "/* \n   [Local Override Mode]\n   You are running offline.\n   \n   CSS written here will be added ON TOP of the base theme.\n   (e.g. h1 { color: blue; })\n*/\n\n";

        if (currentOverride) {
            cssEditor.value = currentOverride;
        } else {
            cssEditor.value = placeholder;
        }
        cssEditor.disabled = false;
    }
    cssModal.classList.remove('hidden');
}

function closeEditor() {
    cssModal.classList.add('hidden');
}

function saveCss() {
    const newCss = cssEditor.value;

    // 1. Apply to Override Tag
    themeOverride.textContent = newCss;

    // NOTE: We do NOT touch baseThemeLink here. 
    // loadTheme already decided if it should be empty or active.

    // Update raw state if we are in Full Mode
    if (baseThemeLink.getAttribute('href') === '') {
        currentThemeRawCss = newCss;
    }

    // 2. Persist to LocalStorage
    localStorage.setItem(`netmd_theme_${currentTheme}`, newCss);

    closeEditor();
}

async function resetCss() {
    console.log("Reset Clicked - Starting process");
    // Removed native confirm as it may fail in some local contexts
    // if(!confirm('Are you sure you want to reset this theme to default?')) return;

    console.log(`[Theme] Resetting ${currentTheme}...`);

    try {
        // 1. Clear Storage
        localStorage.removeItem(`netmd_theme_${currentTheme}`);
        currentThemeRawCss = '';
        console.log("Storage cleared");

        // 2. Clear Override Tag
        themeOverride.textContent = '';
        console.log("Override tag cleared");

        // 3. Reload Default (Re-enables link if needed)
        await loadTheme(currentTheme);
        console.log("Theme reloaded");

        // 4. Update Editor if open
        const placeholder = "/* \n   [Local Override Mode]\n   You are running offline.\n   \n   CSS written here will be added ON TOP of the base theme.\n   (e.g. h1 { color: blue; })\n*/\n\n";

        if (cssEditor) {
            cssEditor.value = currentThemeRawCss || placeholder;
            console.log("Editor value updated");
        } else {
            console.error("cssEditor element not available");
        }
    } catch (e) {
        console.error("Reset Failed:", e);
    }
}

// Default Content
const defaultText = `# NetMD - Markdown Reference
*A comprehensive guide to all supported elements.*

## Text Formatting
**Bold Text** and *Italic Text* or ***Bold Italic***.
~~Strikethrough~~ is also supported.
You can also use <u>Underline</u> via HTML tags.

## Headers
# H1
## H2
### H3
#### H4
##### H5
###### H6

## Lists
### Unordered
- Item 1
- Item 2
  - Nested Item 2.1
  - Nested Item 2.2
    - Deeply Nested

### Ordered
1. First
2. Second
3. Third
   1. Sub-item
   2. Sub-item

### Task List
- [x] Completed task
- [ ] Pending task
- [ ] **Bold** task name

## Code
Inline \`code\` looks like this.

\`\`\`javascript
// JavaScript Block
function sayHello() {
  console.log("Hello, World!");
}
\`\`\`

\`\`\`python
# Python Block
def add(a, b):
    return a + b
\`\`\`

## Blockquotes
> This is a blockquote.
>
> > Nested blockquote.

## Tables
| Left Align | Center Align | Right Align |
| :--- | :---: | ---: |
| Cell 1 | Cell 2 | Cell 3 |
| Row 2 | Data | Data |

## Links & Images
[Click me](https://example.com)

![Placeholder Image](icons/placeholder.png)

## HTML Elements
<details>
<summary>Click to expand</summary>
Hidden content revealed!
</details>

<br>

<kbd>Ctrl</kbd> + <kbd>C</kbd>

## Emojis (Unicode)
🚀 💻 📝 ✨ 🎉 🔒

## Horizontal Rule
---

Now, let's see how your markdown looks like!
`;

// Event Listeners (wrapped in DOMContentLoaded)

