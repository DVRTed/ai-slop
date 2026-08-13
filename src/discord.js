import fs from "fs";

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

export function getRandomSarahsComic() {
  const archivePath = new URL("./archive.json", import.meta.url);
  const archiveData = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  const strips = Object.values(archiveData);

  if (strips.length === 0) {
    throw new Error("archive.json is empty.");
  }

  const randomIndex = Math.floor(Math.random() * strips.length);
  return strips[randomIndex];
}

export async function sendSarahsComic(webhookUrl) {
  const comic = getRandomSarahsComic();

  const embed = {
    title: "Sarah's Scribbles",
    url: comic.pageUrl,
    image: { url: comic.imgUrl },
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
