import { chromium } from "playwright-core";
import { execSync } from "child_process";

function findChromium() {
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const p of candidates) {
    try {
      execSync(`test -x ${p}`);
      return p;
    } catch {}
  }
  throw new Error("No system Chromium found. Install chromium or google-chrome.");
}

export async function sendToDiscord(webhookUrl, aniBuffer, usrBuffer) {
  const payloads = [
    { buf: aniBuffer, name: "ani.png" },
    { buf: usrBuffer, name: "usr.png" },
  ];

  for (const { buf, name } of payloads) {
    const form = new FormData();
    form.append("files[0]", new Blob([buf], { type: "image/png" }), name);

    const res = await fetch(webhookUrl, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Discord webhook failed for ${name}: ${res.status} - ${text}`,
      );
    }

    console.log(`Sent ${name} to Discord successfully.`);

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function randomComicDate() {
  const START = new Date("2014-01-27T00:00:00Z");
  const END = new Date();
  END.setUTCDate(END.getUTCDate() - 1);
  while (true) {
    const ms = START.getTime() + Math.floor(Math.random() * (END.getTime() - START.getTime()));
    const d = new Date(ms);
    const day = d.getUTCDay();
    if (day === 1 || day === 3 || day === 6) {
      return d;
    }
  }
}

export async function fetchRandomSarahsComic() {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    for (let attempt = 0; attempt < 15; attempt++) {
      const comicDate = randomComicDate();
      const yyyy = comicDate.getUTCFullYear();
      const mm = String(comicDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(comicDate.getUTCDate()).padStart(2, "0");
      const pageUrl = `https://www.gocomics.com/sarahs-scribbles/${yyyy}/${mm}/${dd}`;

      console.log(`Trying ${yyyy}-${mm}-${dd}…`);

      const res = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

      if (res && res.status() === 404) {
        console.log("No comic on that date (404), retrying…");
        continue;
      }

      await page.waitForTimeout(4000);

      const title = await page.title();
      if (title.includes("404")) {
        console.log("404 page title, retrying…");
        continue;
      }

      const imageUrl = await page.$$eval("img", (imgs) => {
        const found = imgs.find(
          (n) =>
            n.src.includes("featureassets.gocomics.com") ||
            n.src.includes("assets.amuniversal.com") ||
            n.className.includes("comic__image"),
        );
        return found ? found.src : null;
      });

      if (!imageUrl) {
        console.log("Comic image element not found, retrying…");
        continue;
      }

      return { imageUrl, comicDate, pageUrl };
    }

    throw new Error("Failed to find a Sarah's Scribbles comic after multiple attempts.");
  } finally {
    await browser.close();
  }
}

export async function sendSarahsComic(webhookUrl) {
  const { imageUrl, comicDate, pageUrl } = await fetchRandomSarahsComic();

  const dateStr = comicDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const embed = {
    title: "Sarah's Scribbles",
    url: pageUrl,
    description: `-# ${dateStr}`,
    image: { url: imageUrl },
  };

  console.log("Sending Sarah's Scribbles embed to Discord…");

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!discordRes.ok) {
    const text = await discordRes.text();
    throw new Error(
      `Discord webhook failed for Sarah's comic: ${discordRes.status} - ${text}`,
    );
  }

  console.log("Sent Sarah's Scribbles comic to Discord successfully.");
}
