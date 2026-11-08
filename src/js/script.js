
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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Extracts and formats YAML frontmatter at document start
 */
function processFrontmatter(markdown) {
    const trimmed = markdown.trimStart();
    if (!trimmed.startsWith('---')) {
        return { frontmatterHtml: '', bodyMarkdown: markdown, meta: {} };
    }

    const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) {
        return { frontmatterHtml: '', bodyMarkdown: markdown, meta: {} };
    }

    const rawYaml = match[1];
    const offset = markdown.indexOf(match[0]) + match[0].length;
    const bodyMarkdown = markdown.slice(offset);

    const meta = {};
    const rows = [];
    const lines = rawYaml.split(/\r?\n/);
    for (let line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > -1) {
            const key = line.slice(0, colonIdx).trim();
            let val = line.slice(colonIdx + 1).trim();
            if (key) {
                meta[key] = val;
                let displayVal = '';
                if (val.startsWith('[') && val.endsWith(']')) {
                    const items = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                    displayVal = items.map(it => `<span class="obs-tag">${escapeHtml(it.startsWith('#') ? it : '#' + it)}</span>`).join(' ');
                } else {
                    displayVal = escapeHtml(val.replace(/^['"]|['"]$/g, ''));
                }
                rows.push(`<tr><th>${escapeHtml(key)}</th><td>${displayVal}</td></tr>`);
            }
        }
    }

    if (rows.length === 0) {
        return { frontmatterHtml: '', bodyMarkdown: markdown, meta };
    }

    const frontmatterHtml = `
<div class="obs-frontmatter metadata-properties">
  <div class="obs-frontmatter-header">
    <span class="obs-frontmatter-icon">📋</span>
    <span class="obs-frontmatter-title">Properties</span>
  </div>
  <table>
    <tbody>
      ${rows.join('\n')}
    </tbody>
  </table>
</div>`;

    return { frontmatterHtml, bodyMarkdown, meta };
}

/**
 * Creates documentation breadcrumbs (used in GitBook / Docusaurus)
 */
function createBreadcrumb(meta, bodyMarkdown) {
    let title = meta.title || '';
    if (!title) {
        const h1Match = bodyMarkdown.match(/^#\s+(.+)$/m);
        if (h1Match) {
            title = h1Match[1].replace(/[*_~`]/g, '').trim();
        }
    }
    if (!title) return '';

    return `
<div class="doc-breadcrumb">
  <a href="#">Docs</a>
  <span class="sep">/</span>
  <a href="#">Reference</a>
  <span class="sep">/</span>
  <span>${escapeHtml(title)}</span>
</div>`;
}

/**
 * Adds data-lang attribute to <pre> so themes can display language headers
 */
function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach(codeEl => {
        let lang = '';
        codeEl.classList.forEach(cls => {
            if (cls.startsWith('language-')) {
                lang = cls.replace('language-', '').trim();
            }
        });
        if (lang && codeEl.parentElement && codeEl.parentElement.tagName === 'PRE') {
            codeEl.parentElement.setAttribute('data-lang', lang);
        }
    });
}

/**
 * Transforms GitHub / Obsidian / GitBook alert callouts (> [!NOTE], etc.)
 */
function enhanceAlerts(container) {
    const alertTypes = {
        NOTE:      { type: 'note',      icon: 'ℹ️',  title: 'Note',      colorClass: 'blue',   obsClass: 'info',    docClass: 'note' },
        TIP:       { type: 'tip',       icon: '💡',  title: 'Tip',       colorClass: 'green',  obsClass: 'tip',     docClass: 'tip' },
        IMPORTANT: { type: 'important', icon: '📌',  title: 'Important', colorClass: 'purple', obsClass: 'tip',     docClass: 'info' },
        WARNING:   { type: 'warning',   icon: '⚠️',  title: 'Warning',   colorClass: 'yellow', obsClass: 'warning', docClass: 'caution' },
        CAUTION:   { type: 'caution',   icon: '🛑',  title: 'Caution',   colorClass: 'red',    obsClass: 'danger',  docClass: 'danger' },
        INFO:      { type: 'note',      icon: 'ℹ️',  title: 'Info',      colorClass: 'blue',   obsClass: 'info',    docClass: 'info' },
        DANGER:    { type: 'caution',   icon: '🚨',  title: 'Danger',    colorClass: 'red',    obsClass: 'danger',  docClass: 'danger' },
        SUCCESS:   { type: 'tip',       icon: '✅',  title: 'Success',   colorClass: 'green',  obsClass: 'success', docClass: 'tip' }
    };

    container.querySelectorAll('blockquote').forEach(bq => {
        const firstP = bq.querySelector('p') || bq;
        const html = firstP.innerHTML;
        const match = html.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|DANGER|SUCCESS)\](?:\s*<br\s*\/?>|\s+)?/i);
        if (match) {
            const rawType = match[1].toUpperCase();
            const config = alertTypes[rawType] || alertTypes.NOTE;

            // Remove the [!TYPE] marker
            firstP.innerHTML = html.slice(match[0].length);

            const alertDiv = document.createElement('div');
            alertDiv.className = `markdown-alert gh-alert gh-alert-${config.type} notion-callout ${config.colorClass} obs-callout ${config.obsClass} doc-admonition ${config.docClass}`;
            alertDiv.setAttribute('data-callout', config.type);

            alertDiv.innerHTML = `
                <div class="gh-alert-icon notion-callout-icon obs-callout-icon doc-admonition-icon">${config.icon}</div>
                <div class="gh-alert-body notion-callout-body obs-callout-body doc-admonition-body">
                    <div class="gh-alert-title obs-callout-title doc-admonition-title">${config.title}</div>
                    <div class="gh-alert-content notion-callout-content obs-callout-content doc-admonition-content">
                        ${bq.innerHTML}
                    </div>
                </div>
            `;
            bq.replaceWith(alertDiv);
        }
    });
}

/**
 * Transforms Obsidian-style wiki-links [[Target]] and tags #tag
 */
function enhanceWikiLinksAndTags(container) {
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName.toLowerCase();
                if (['pre', 'code', 'a', 'kbd', 'script', 'style', 'textarea'].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (parent.closest('pre, code, a, .obs-frontmatter')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    textNodes.forEach(node => {
        const text = node.nodeValue;
        if (!text || (!text.includes('[[') && !text.includes('#'))) return;

        const wikiRegex = /\[\[([^\]\r\n|]+)(?:\|([^\]\r\n]+))?\]\]/g;
        const tagRegex = /(^|\s)#([a-zA-Z0-9_\-\/]+)(?=[\s).,;!?]|$)/g;

        const hasWiki = wikiRegex.test(text);
        wikiRegex.lastIndex = 0;
        const hasTag = tagRegex.test(text);
        tagRegex.lastIndex = 0;

        if (!hasWiki && !hasTag) return;

        let processed = escapeHtml(text);

        if (hasWiki) {
            processed = processed.replace(/\[\[([^\]\r\n|]+)(?:\|([^\]\r\n]+))?\]\]/g, (m, target, label) => {
                const cleanTarget = target.trim();
                const cleanLabel = (label || cleanTarget).trim();
                return `<a class="obs-wikilink internal-link" href="#${encodeURIComponent(cleanTarget)}" title="${escapeHtml(cleanTarget)}">${escapeHtml(cleanLabel)}</a>`;
            });
        }

        const isHeading = node.parentElement && /^h[1-6]$/i.test(node.parentElement.tagName);
        if (hasTag && !isHeading) {
            processed = processed.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)(?=[\s).,;!?]|$)/g, (m, prefix, tag) => {
                return `${prefix}<span class="obs-tag">#${escapeHtml(tag)}</span>`;
            });
        }

        if (processed !== escapeHtml(text)) {
            const span = document.createElement('span');
            span.innerHTML = processed;
            node.replaceWith(...span.childNodes);
        }
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

        // 1. Process frontmatter
        const { frontmatterHtml, bodyMarkdown, meta } = processFrontmatter(rawMarkdown);

        // 2. Generate breadcrumb for docs theme
        const breadcrumbHtml = createBreadcrumb(meta, bodyMarkdown);

        // 3. Parse Markdown
        const rawHtml = marked.parse(bodyMarkdown);
        const fullHtml = breadcrumbHtml + frontmatterHtml + rawHtml;

        // 4. Sanitize HTML
        let cleanHtml = fullHtml;
        if (typeof DOMPurify !== 'undefined') {
            cleanHtml = DOMPurify.sanitize(fullHtml, {
                USE_PROFILES: { html: true },
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
            });
        }

        preview.innerHTML = cleanHtml;

        // 5. Post-process DOM for advanced features
        enhanceCodeBlocks(preview);
        enhanceAlerts(preview);
        enhanceWikiLinksAndTags(preview);

        // 6. Update document title
        updateTitle(meta.title || rawMarkdown);
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
const defaultText = `
---
title: Markdown Kitchen Sink
author: NetMD Team
tags: [markdown, documentation, themes, preview]
date: 2026-11-08
status: published
version: 1.0.2
---

# Markdown Kitchen Sink
*A comprehensive guide to all supported elements across all themes.*

## Text Formatting
**Bold Text** and *Italic Text* or ***Bold Italic***.
~~Strikethrough~~ is also supported.
You can also use <u>Underline</u> via HTML tags.

## Headers
# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header

## Alerts & Callouts (GitHub, Notion, Obsidian, GitBook)
> [!NOTE]
> Highlights useful information that users should take note of even when skimming.

> [!TIP]
> Helpful advice or best practices for doing things more effectively.

> [!IMPORTANT]
> Key information essential for users to achieve their goal.

> [!WARNING]
> Urgent info that requires immediate user attention to avoid problems.

> [!CAUTION]
> Advises about potential risks or negative consequences of an action.

## Knowledge & Connections (Obsidian Style)
Here are internal wiki-links: [[Architecture Overview]] and [[Configuration Guide|Custom Setup Options]].

Categorized tag badges: #documentation #release/v1.0 #guide #productivity

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
// JavaScript Block with Language Header
function sayHello(name) {
  console.log(\`Hello, \${name}! Welcome to NetMD.\`);
}

sayHello("Developer");
\`\`\`

\`\`\`python
# Python Block with Language Header
def calculate_metrics(values):
    return {
        "count": len(values),
        "total": sum(values),
        "mean": sum(values) / len(values) if values else 0
    }
\`\`\`

## Blockquotes
> This is a standard blockquote.
>
> > Nested blockquotes are also supported.

## Interactive Toggles (Notion Style)
<details>
<summary>Click to expand: What makes NetMD unique?</summary>
NetMD operates 100% locally inside your browser, guaranteeing total privacy while rendering Markdown to PDF. No data ever leaves your computer.
</details>

<details>
<summary>Click to expand: Supported Theme Styles</summary>
- **GitHub**: Clean, technical with language headers and native alerts.
- **Notion**: Modular page with tinted callouts, fluid toggles and clean tables.
- **Obsidian**: Connected knowledge with wiki-links, tag pills, and property tables.
- **Typora**: Distraction-free WYSIWYG reading experience with editorial typography.
- **GitBook / Docusaurus**: Technical manual layout with breadcrumbs and admonitions.
</details>

## Tables
| Feature | GitHub | Notion | Obsidian | Typora | GitBook |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Code Language Headers | Yes | Yes | Yes | Yes | Yes |
| Callouts / Alerts | GFM Alerts | Tinted Blocks | Box Callouts | Quote Box | Admonition Bars |
| Wiki-links | Yes | Mention | Wiki Pill | Underline | Cross-ref |
| Tag Badges | Topic Badge | Property Pill | Mauve Pill | Minimal | Doc Badge |

## Links & Images
[Visit Example](https://example.com)

![Placeholder Image](../assets/icons/placeholder.png)

## HTML Elements
Keyboard shortcuts: <kbd>Ctrl</kbd> + <kbd>C</kbd> or <kbd>Cmd</kbd> + <kbd>P</kbd> to print.

## Emojis (Unicode)
🚀 💻 📝 ✨ 🎉 🔒 📊 💡

## Horizontal Rule
---
End of document.

`;

// Event Listeners (wrapped in DOMContentLoaded)

