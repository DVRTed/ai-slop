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
      throw new Error(`Discord webhook failed for ${name}: ${res.status} - ${text}`);
    }

    console.log(`Sent ${name} to Discord successfully.`);

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export async function sendNewsEmbed(webhookUrl, hantavirus, news) {
  const hasHantaError = hantavirus.error === true;
  const hasNewsError = news.error === true;
  const hasAnyError = hasHantaError || hasNewsError;

  const hantaValue = hasHantaError
    ? `\u26a0\ufe0f ${hantavirus.summary}`
    : hantavirus.summary + (hantavirus.lastUpdated
      ? `\n*Last updated: ${hantavirus.lastUpdated}*`
      : "");

  const newsValue = hasNewsError
    ? `\u26a0\ufe0f ${news.description}`
    : `**${news.title}**\n${news.description}`;

  const sourcesText = hasNewsError
    ? "No sources available"
    : (news.sources || [])
        .map((s, i) => `${i + 1}. **${s.name}**: ${s.url}`)
        .join("\n") || "No sources available";

  const embed = {
    title: "\ud83c\udf0d Daily Briefing",
    color: hasAnyError ? 0xed4245 : 0x2f3136,
    fields: [
      {
        name: hasHantaError ? "\u26a0\ufe0f Hantavirus Status" : "\ud83e\uddea Hantavirus Status",
        value: hantaValue,
        inline: false,
      },
      {
        name: hasNewsError ? "\u26a0\ufe0f Top Breaking News" : "\ud83d\udcf0 Top Breaking News",
        value: newsValue,
        inline: false,
      },
      {
        name: "Sources",
        value: sourcesText,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed for news embed: ${res.status} - ${text}`);
  }

  console.log("Sent news embed to Discord successfully.");
}
