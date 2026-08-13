// build-archive.js
//
// Crawls ArcaMax's Sarah's Scribbles pages backward through the "previous strip"
// link and saves { id, date, imgUrl, pageUrl } for each strip into archive.json.
// Run this once to build a big local archive, then re-run occasionally
// (e.g. weekly) to pick up new strips. Safe to stop/resume — it skips
// ids it already has.

import fs from 'fs';
import * as cheerio from 'cheerio';

const BASE = 'https://www.arcamax.com/thefunnies/sarahsscribbles';
const ARCHIVE_FILE = './archive.json';
const MAX_STRIPS_PER_RUN = 500;   // stop after this many new strips (raise/lower as you like)
const DELAY_MS = 400;             // be polite between requests

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

function loadArchive() {
    if (fs.existsSync(ARCHIVE_FILE)) {
        return JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));
    }
    return {};
}

function saveArchive(archive) {
    fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));
}

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

// Parses a strip page and returns { id, imgUrl, pageUrl, prevId }
function parseStripPage(html, pageUrl) {
    const $ = cheerio.load(html);

    const prevHref = $('a.prev').attr('href') || '';
    const prevMatch = prevHref.match(/s-(\d+)/);
    const prevId = prevMatch ? prevMatch[1] : null;

    let canonicalUrl = $('meta[property="og:url"]').attr('content') || pageUrl;
    let idMatch = canonicalUrl.match(/s-(\d+)/);
    const id = idMatch ? idMatch[1] : null;

    const imgUrl = $('figure img, .comic-image, img[src*="newspics"]').attr('src') || $('meta[property="og:image"]').attr('content');

    return { id, imgUrl, pageUrl: canonicalUrl, prevId };
}

async function fetchStripById(id) {
    const url = `${BASE}/s-${id}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parseStripPage(html, url);
}

async function fetchLatestStrip() {
    const url = `${BASE}/`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const parsed = parseStripPage(html, url);
    if (!parsed.id && parsed.prevId) {
        // Fetch the strip pointed by prevId to determine current state,
        // or fetch prevId directly
        return await fetchStripById(parsed.prevId);
    }
    return parsed;
}

async function main() {
    const archive = loadArchive();
    console.log(`Loaded ${Object.keys(archive).length} existing strips.`);

    let current = await fetchLatestStrip();
    if (!current.id) {
        console.error('Could not determine latest strip id — ArcaMax may have changed their page structure.');
        console.error('Try inspecting the raw HTML around the comic title/nav links.');
        process.exit(1);
    }

    let fetched = 0;
    while (current && current.id && fetched < MAX_STRIPS_PER_RUN) {
        if (!archive[current.id]) {
            archive[current.id] = {
                id: current.id,
                imgUrl: current.imgUrl,
                pageUrl: current.pageUrl,
            };
            saveArchive(archive);
            fetched++;
            console.log(`Saved strip ${current.id} (${fetched}/${MAX_STRIPS_PER_RUN})`);
        } else {
            console.log(`Already have strip ${current.id}, stopping (caught up to previous run).`);
            break;
        }

        if (!current.prevId) {
            console.log('No previous strip found — reached the start of the archive (or selector needs tweaking).');
            break;
        }

        await sleep(DELAY_MS);
        try {
            current = await fetchStripById(current.prevId);
        } catch (err) {
            console.error(`Failed to fetch strip ${current.prevId}:`, err.message);
            break;
        }
    }

    saveArchive(archive);
    console.log(`Done. Archive now has ${Object.keys(archive).length} strips saved to ${ARCHIVE_FILE}.`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});