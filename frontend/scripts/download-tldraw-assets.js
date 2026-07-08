const fs = require('fs');
const path = require('path');
const https = require('https');

const VERSION = '5.1.1';
const BASE_URL = `https://cdn.jsdelivr.net/npm/@tldraw/assets@${VERSION}`;
const TARGET_DIR = path.join(__dirname, '../public/tldraw-assets');

const fonts = [
    'IBMPlexMono-Medium.woff2',
    'IBMPlexMono-MediumItalic.woff2',
    'IBMPlexMono-Bold.woff2',
    'IBMPlexMono-BoldItalic.woff2',
    'IBMPlexSerif-Medium.woff2',
    'IBMPlexSerif-MediumItalic.woff2',
    'IBMPlexSerif-Bold.woff2',
    'IBMPlexSerif-BoldItalic.woff2',
    'IBMPlexSans-Medium.woff2',
    'IBMPlexSans-MediumItalic.woff2',
    'IBMPlexSans-Bold.woff2',
    'IBMPlexSans-BoldItalic.woff2',
    'Shantell_Sans-Informal_Regular.woff2',
    'Shantell_Sans-Informal_Regular_Italic.woff2',
    'Shantell_Sans-Informal_Bold.woff2',
    'Shantell_Sans-Informal_Bold_Italic.woff2'
];

const icons = [
    'icons/icon/0_merged.svg'
];

const embedIcons = [
    'github.png',
    'youtube.png',
    'vimeo.png',
    'spotify.png',
    'figma.png',
    'google_maps.png',
    'google_calendar.png',
    'google_slides.png',
    'google_sheets.png',
    'google_docs.png',
    'excalidraw.png',
    'val_town.png',
    'tldraw.png',
    'scratchpad.png',
    'codepen.png',
    'desmos.png',
    'felt.png',
    'github_gist.png',
    'observable.png',
    'replit.png',
    'pdf.png'
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log(`Downloading tldraw ${VERSION} assets to ${TARGET_DIR}...`);
    
    // Create folders
    fs.mkdirSync(path.join(TARGET_DIR, 'fonts'), { recursive: true });
    fs.mkdirSync(path.join(TARGET_DIR, 'icons/icon'), { recursive: true });
    fs.mkdirSync(path.join(TARGET_DIR, 'embed-icons'), { recursive: true });
    fs.mkdirSync(path.join(TARGET_DIR, 'translations'), { recursive: true });

    // Download fonts
    for (const font of fonts) {
        const url = `${BASE_URL}/fonts/${font}`;
        const dest = path.join(TARGET_DIR, 'fonts', font);
        console.log(`Downloading Font: ${font}`);
        try {
            await download(url, dest);
        } catch (e) {
            console.error(`Failed to download font ${font}:`, e.message);
        }
    }

    // Download icons
    for (const icon of icons) {
        const url = `${BASE_URL}/${icon}`;
        const dest = path.join(TARGET_DIR, icon);
        console.log(`Downloading Icon: ${icon}`);
        try {
            await download(url, dest);
        } catch (e) {
            console.error(`Failed to download icon ${icon}:`, e.message);
        }
    }

    // Download embed icons
    for (const embed of embedIcons) {
        const url = `${BASE_URL}/embed-icons/${embed}`;
        const dest = path.join(TARGET_DIR, 'embed-icons', embed);
        console.log(`Downloading Embed Icon: ${embed}`);
        try {
            await download(url, dest);
        } catch (e) {
            console.error(`Failed to download embed icon ${embed}:`, e.message);
        }
    }

    // Download en.json translation
    try {
        console.log('Downloading translation: en.json');
        await download(`${BASE_URL}/translations/en.json`, path.join(TARGET_DIR, 'translations/en.json'));
    } catch (e) {
        console.error('Failed to download en.json:', e.message);
    }

    console.log('All tldraw assets downloaded successfully!');
}

main().catch(console.error);
