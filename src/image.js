import sharp from "sharp";
import { createCanvas } from "canvas";

const W = 1600;
const PAD = 64;
const DEFS = (orb1, orb2) => `
  <defs>
    <filter id="blurLg" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="160"/>
    </filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6" />
    </filter>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.01" />
    </linearGradient>
    <linearGradient id="cardBorder" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02" />
    </linearGradient>
    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#09090b"/>
  <circle cx="0%" cy="0%" r="800" fill="${orb1}" opacity="0.12" filter="url(#blurLg)"/>
  <circle cx="100%" cy="100%" r="800" fill="${orb2}" opacity="0.12" filter="url(#blurLg)"/>
`;

const STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&amp;display=swap');
    text { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
    .header-title { font-size: 56px; font-weight: 800; fill: #ffffff; letter-spacing: -2px; }
    .header-sub { font-size: 18px; font-weight: 500; fill: #a1a1aa; letter-spacing: 1.5px; text-transform: uppercase; }
    .card-title { font-size: 32px; font-weight: 600; fill: #ffffff; letter-spacing: -0.5px; }
    .card-desc { font-size: 24px; font-weight: 400; fill: #a1a1aa; }
    .meta { font-size: 18px; font-weight: 500; fill: #71717a; }
  </style>
`;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text, maxChars) {
  const words = String(text ?? "").split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function textLines(lines, x, startY, lh, className) {
  return lines
    .map((line, i) => `<text x="${x}" y="${startY + i * lh}" class="${className}">${esc(line)}</text>`)
    .join("\n");
}

function dramaBar(score, x, y) {
  return [1, 2, 3]
    .map(
      (n, i) =>
        `<rect x="${x + i * 32}" y="${y - 8}" width="24" height="12" rx="6" fill="${
          n <= score ? "#ef4444" : "#27272a"
        }"/>`,
    )
    .join("");
}

function statusBadge(status, x, y) {
  const ignored = status === "ignored";
  const color = ignored ? "#ef4444" : "#eab308";
  const label = ignored ? "IGNORED" : "PARTIAL";
  const bw = 120;
  return `
    <rect x="${x}" y="${y - 24}" width="${bw}" height="36" rx="18" fill="${color}1A" stroke="${color}4D" stroke-width="2"/>
    <text x="${x + bw / 2}" y="${y + 2}" class="meta" style="font-size: 14px; font-weight: 600; fill: ${color}; letter-spacing: 1.5px" text-anchor="middle">${label}</text>`;
}

export async function generateANIImage(incidents) {
  const IW = W - PAD * 2;
  const CP = 48;
  const TITLE_LH = 46;
  const DESC_LH = 36;
  const PARTS_LH = 32;

  const cards = incidents.map((inc) => {
    const titleLines = wrap(inc.title, 75);
    const summaryLines = wrap(inc.summary, 100).slice(0, 5);
    const parts = (inc.participants ?? []).slice(0, 4).join(", ");

    const titleH = titleLines.length * TITLE_LH;
    const partsH = parts ? PARTS_LH : 0;
    const descH = summaryLines.length * DESC_LH;
    const h = CP + titleH + (parts ? 12 : 0) + partsH + 24 + descH + 36 + 20 + CP;

    return {
      ...inc,
      titleLines,
      summaryLines,
      parts,
      cardH: h,
      titleH,
      partsH,
      descH,
    };
  });

  const HEADER_H = 240;
  const totalH = HEADER_H + cards.reduce((s, c) => s + c.cardH + 32, 0) + PAD;

  let y = HEADER_H;
  const cardSvgs = cards
    .map((card) => {
      const cy = y;
      y += card.cardH + 32;

      const titleY = cy + CP + 34;
      const partsY = cy + CP + card.titleH + 22;
      const descStartY = cy + CP + card.titleH + (card.parts ? 12 + card.partsH : 0) + 30;
      const dotsY = cy + CP + card.titleH + (card.parts ? 12 + card.partsH : 0) + 24 + card.descH + 50;

      const pax = PAD + 48 + 112;
      const txtOut = String(card.outcome || "").trim();
      const hasOut =
        txtOut &&
        !["null", "none", "n/a", "none yet", "unresolved", "pending"].includes(txtOut.toLowerCase());

      return `
    <rect x="${PAD}" y="${cy}" width="${IW}" height="${card.cardH}" rx="20" fill="#09090b" filter="url(#shadow)"/>
    <rect x="${PAD}" y="${cy}" width="${IW}" height="${card.cardH}" rx="20" fill="url(#cardGrad)" stroke="url(#cardBorder)" stroke-width="2"/>
    <rect x="${PAD}" y="${cy}" width="8" height="${card.cardH}" rx="4" fill="#ef4444"/>
    ${textLines(card.titleLines, PAD + 48, titleY, TITLE_LH, "card-title")}
    ${
      card.parts
        ? `<text x="${PAD + 48}" y="${partsY}" class="meta" style="fill: #9ca3af; font-weight: 500">Participants: ${esc(
            card.parts,
          )}</text>`
        : ""
    }
    ${textLines(card.summaryLines, PAD + 48, descStartY, DESC_LH, "card-desc")}
    ${dramaBar(card.dramaScore, PAD + 48, dotsY)}
    ${
      hasOut
        ? `<text x="${pax}" y="${dotsY + 6}" class="meta" style="fill: #f87171; font-weight: 600">Outcome: ${esc(
            txtOut,
          )}</text>`
        : ""
    }
    `;
    })
    .join("\n");

  const svg = `<svg width="${W}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS("#ef4444", "#f97316")}
  ${STYLE}
  <rect width="${W}" height="8" fill="#ef4444"/>
  <text x="${PAD}" y="112" class="header-title">ANI Drama Digest</text>
  <text x="${PAD}" y="152" class="header-sub">Wikipedia Administrators' Noticeboard/Incidents  •  ${esc(
    new Date().toISOString().replace("T", " ").substring(0, 16) + " UTC",
  )}</text>
  <rect x="${PAD}" y="192" width="${W - PAD * 2}" height="1" fill="url(#lineGrad)"/>
  ${cardSvgs}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateUSRImage(requests) {
  const request = requests[0];
  const canvas = createCanvas(W, 600);
  const ctx = canvas.getContext("2d");

  // Background with gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 600);
  bgGrad.addColorStop(0, "#0f172a");
  bgGrad.addColorStop(1, "#020617");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, 600);

  // Background glows
  const gradA = ctx.createRadialGradient(W * 0.2, 100, 0, W * 0.2, 100, 300);
  gradA.addColorStop(0, "rgba(251, 146, 60, 0.15)");
  gradA.addColorStop(1, "rgba(251, 146, 60, 0)");
  ctx.fillStyle = gradA;
  ctx.beginPath();
  ctx.arc(W * 0.2, 100, 300, 0, Math.PI * 2);
  ctx.fill();

  const gradB = ctx.createRadialGradient(W * 0.8, 200, 0, W * 0.8, 200, 280);
  gradB.addColorStop(0, "rgba(56, 189, 248, 0.12)");
  gradB.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = gradB;
  ctx.beginPath();
  ctx.arc(W * 0.8, 200, 280, 0, Math.PI * 2);
  ctx.fill();

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Arial";
  const titleLines = request ? wrap(request.title, 60) : ["No unresolved request found"];
  let y = 80;
  for (const line of titleLines) {
    ctx.fillText(line, 64, y);
    y += 52;
  }

  // AI summary header
  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 22px Arial";
  ctx.fillText("Summary", 64, y + 40);

  // Summary lines
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "400 26px Arial";
  const summaryLines = request ? wrap(request.description, 80).slice(0, 3) : [];
  y += 80;
  for (const line of summaryLines) {
    ctx.fillText(line, 64, y);
    y += 34;
  }

  // Technical context header
  if (request) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 20px Arial";
    ctx.fillText("Technical context", 64, y + 20);
  }

  // Details lines
  if (request) {
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "400 24px Arial";
    const detailsLines = wrap(request.details, 78).slice(0, 4);
    y += 60;
    for (const line of detailsLines) {
      ctx.fillText(line, 64, y);
      y += 30;
    }
  }

  // Chips for status and complexity
  if (request) {
    // Status chip
    ctx.fillStyle = "rgba(220, 38, 38, 0.1)";
    roundRect(ctx, 64, y + 40, 180, 60, 8);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#dc2626";
    ctx.font = "700 18px Arial";
    ctx.fillText("STATUS", 74, y + 68);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 18px Arial";
    ctx.fillText(request.status.toUpperCase(), 74, y + 88);

    // Complexity chip
    ctx.fillStyle = "rgba(234, 88, 12, 0.1)";
    roundRect(ctx, 280, y + 40, 280, 60, 8);
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ea580c";
    ctx.font = "700 18px Arial";
    ctx.fillText("COMPLEXITY", 290, y + 68);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 16px Arial";
    ctx.fillText(`${request.difficulty} • ${request.timeEstimate}`, 290, y + 88);
  }

  return canvas.toBuffer("image/png");
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}
