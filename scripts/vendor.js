const fs = require('fs');
const path = require('path');
const https = require('https');

// Mapping of source files in node_modules to destination in lib
const files = [
    { src: 'node_modules/marked/marked.min.js', dest: 'lib/marked.min.js' },
    // PrismJS main file
    { src: 'node_modules/prismjs/prism.js', dest: 'lib/prism.min.js' },
    // PrismJS default theme
    { src: 'node_modules/prismjs/themes/prism.css', dest: 'lib/prism.css' },
    // DOMPurify
    { src: 'node_modules/dompurify/dist/purify.min.js', dest: 'lib/purify.min.js' }
];

const destDir = path.resolve(__dirname, '../lib');
const tailwindUrl = 'https://unpkg.com/tailwindcss@2.2.19/dist/tailwind.min.css';
const tailwindDest = path.join(destDir, 'tailwind.min.css');

// Ensure lib directory exists
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Vendor Script: Copying dependencies to ${destDir}...`);

let errorCount = 0;

async function main() {
    // 1. Copy local node_modules files
    files.forEach(file => {
        const srcPath = path.join(__dirname, '../', file.src);
        const destPath = path.join(__dirname, '../', file.dest);

        try {
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`[OK] ${file.src} -> ${file.dest}`);
            } else {
                console.error(`[MISSING] Source file not found: ${file.src}`);
                errorCount++;
            }
        } catch (e) {
            console.error(`[ERROR] Failed to copy ${file.src}:`, e);
            errorCount++;
        }
    });

    // 2. Download Tailwind CSS (Standalone)
    try {
        await downloadFile(tailwindUrl, tailwindDest);
    } catch (e) {
        console.error(e.message);
        errorCount++;
    }

    // Final Report
    if (errorCount > 0) {
        console.warn(`\nCompleted with ${errorCount} errors. Please check npm install.`);
        process.exit(1);
    } else {
        console.log("\nSuccess! All libraries (including Tailwind) ready in /lib.");
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`[DOWNLOAD] Fetching ${path.basename(dest)}...`);
        const file = fs.createWriteStream(dest);

        https.get(url, function (response) {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', function () {
                    file.close(() => {
                        console.log(`[OK] Downloaded ${path.basename(dest)}`);
                        resolve();
                    });
                });
            } else {
                fs.unlink(dest, () => { }); // Delete empty file
                reject(new Error(`[ERROR] Failed to download ${path.basename(dest)}: Status ${response.statusCode}`));
            }
        }).on('error', function (err) {
            fs.unlink(dest, () => { });
            reject(new Error(`[ERROR] Download error: ${err.message}`));
        });
    });
}

main();

