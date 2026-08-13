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

function randomYearMonth() {
  const startYear = 2014;
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const year = startYear + Math.floor(Math.random() * (currentYear - startYear + 1));
  const maxMonth = year === currentYear ? currentMonth : 12;
  const minMonth = year === 2014 ? 1 : 1;
  const month = minMonth + Math.floor(Math.random() * (maxMonth - minMonth + 1));

  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const dateAfter = `${year}-${mm}-01`;
  const dateBefore = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  return { dateAfter, dateBefore };
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

    console.log("Navigating to GoComics to initialize session…");
    await page.goto("https://www.gocomics.com/sarahs-scribbles", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page.waitForTimeout(3000);

    for (let attempt = 0; attempt < 5; attempt++) {
      const { dateAfter, dateBefore } = randomYearMonth();
      const apiUrl = `https://www.gocomics.com/api/service/v2/assets/feature-runs/sarahs-scribbles?dateAfter=${dateAfter}&dateBefore=${dateBefore}`;

      console.log(`Querying available comics between ${dateAfter} and ${dateBefore}…`);

      const data = await page.evaluate(async (url) => {
        const res = await fetch(url);
        return res.ok ? res.json() : null;
      }, apiUrl);

      if (!data || !data.dates || data.dates.length === 0) {
        console.log("No comics published in this month, trying another month…");
        continue;
      }

      const randomIsoDate = data.dates[Math.floor(Math.random() * data.dates.length)];
      const comicDate = new Date(randomIsoDate);
      const yyyy = comicDate.getUTCFullYear();
      const mm = String(comicDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(comicDate.getUTCDate()).padStart(2, "0");
      const pageUrl = `https://www.gocomics.com/sarahs-scribbles/${yyyy}/${mm}/${dd}`;

      console.log(`Fetching comic for ${yyyy}-${mm}-${dd}…`);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);

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

    throw new Error("Failed to fetch a Sarah's Scribbles comic.");
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
