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
  const endYear = 2024;
  const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
  const month = 1 + Math.floor(Math.random() * 12);

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

      const apiRes = await context.request.get(apiUrl);
      if (!apiRes.ok()) {
        console.log("API returned non-OK status, retrying another month…");
        continue;
      }

      const data = await apiRes.json();
      if (!data || !data.dates || data.dates.length === 0) {
        console.log("No comics published in this month, trying another month…");
        continue;
      }

      const randomIsoDate = data.dates[Math.floor(Math.random() * data.dates.length)];
      const [yyyy, mm, dd] = randomIsoDate.split("T")[0].split("-");
      const comicDate = new Date(Date.UTC(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd)));
      const pageUrl = `https://www.gocomics.com/sarahs-scribbles/${yyyy}/${mm}/${dd}`;

      console.log(`Fetching comic for ${yyyy}-${mm}-${dd}…`);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

      const imgLocator = page
        .locator(
          "img[src*='featureassets.gocomics.com'], img[src*='assets.amuniversal.com'], img[class*='comic__image']",
        )
        .first();

      try {
        await imgLocator.waitFor({ timeout: 10000 });
      } catch {
        console.log("Comic image element not found, retrying…");
        continue;
      }

      const imageUrl = await imgLocator.getAttribute("src");
      if (!imageUrl) {
        console.log("Empty image src, retrying…");
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
