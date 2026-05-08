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

function truncate(str, max = 1024) {
  if (!str) return "-";
  return str.length > max ? str.substring(0, max - 3) + "..." : str;
}

export async function sendNewsEmbed(webhookUrl, hantavirus, news) {
  const hasHantaError = hantavirus.error === true;
  const hasNewsError = news.error === true;
  const hasAnyError = hasHantaError || hasNewsError;

  let hantaValue;
  if (hasHantaError) {
    hantaValue = `\u26a0\ufe0f ${hantavirus.summary}`;
  } else {
    const lines = [
      `**Confirmed:** ${hantavirus.confirmed ?? "N/A"}`,
      `**Deaths:** ${hantavirus.deaths ?? "N/A"}`,
      `**Suspected:** ${hantavirus.suspected ?? "N/A"}`,
    ];
    if (hantavirus.outbreak) {
      lines.push(`\n${hantavirus.outbreak}`);
    }
    if (hantavirus.lastUpdated) {
      lines.push(`\n*Last updated: ${hantavirus.lastUpdated}*`);
    }
    const hantaSources = (hantavirus.sources || [])
      .map((s, i) => `${i + 1}. [${s.name}](${s.url})`)
      .join("\n");
    if (hantaSources) {
      lines.push(`\n${hantaSources}`);
    }
    hantaValue = lines.join("\n");
  }

  const newsValue = hasNewsError
    ? `\u26a0\ufe0f ${news.description}`
    : `**${news.title}**\n${news.description}`;

  const sourcesText = hasNewsError
    ? "No sources available"
    : (news.sources || [])
        .map((s, i) => `${i + 1}. [${s.name}](${s.url})`)
        .join("\n") || "No sources available";

  const embed = {
    title: "\ud83c\udf0d Daily Briefing",
    color: hasAnyError ? 0xed4245 : 0x2f3136,
    fields: [
      {
        name: hasHantaError
          ? "\u26a0\ufe0f Hantavirus Status"
          : "\ud83e\uddea Hantavirus Status",
        value: truncate(hantaValue),
        inline: false,
      },
      {
        name: hasNewsError
          ? "\u26a0\ufe0f Top Breaking News"
          : "\ud83d\udcf0 Top Breaking News",
        value: truncate(newsValue),
        inline: false,
      },
      {
        name: "Sources",
        value: truncate(sourcesText),
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  console.log("Embed payload:", JSON.stringify(embed, null, 2));

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Discord webhook failed for news embed: ${res.status} - ${text}`,
    );
  }

  console.log("Sent news embed to Discord successfully.");
}
