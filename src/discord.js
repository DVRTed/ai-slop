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

export async function sendJudeBellinghamEmbed(webhookUrl, matchInfo) {
  let embed;

  if (matchInfo.error) {
    embed = {
      title: "⚽ Jude Bellingham - Real Madrid",
      description: matchInfo.message,
      color: 0xed4245,
      timestamp: new Date().toISOString(),
    };
  } else if (matchInfo.hasMatch) {
    const matchUnix = Math.floor(new Date(matchInfo.matchDate).getTime() / 1000);

    embed = {
      title: "⚽ Jude Bellingham - Upcoming Match",
      description:
        `**Real Madrid** vs **${matchInfo.opponent}**\n\n` +
        `🗓️ **When:** <t:${matchUnix}:F>\n` +
        `⏳ **Time until:** <t:${matchUnix}:R>\n` +
        `🏆 **Competition:** ${matchInfo.competition}`,
      color: 0xffc400,
      thumbnail: {
        url: "https://images.unsplash.com/photo-1548381528-7e459e3e2d4a?w=200",
      },
      fields: [
        { name: "Home", value: "Real Madrid", inline: true },
        { name: "Away", value: matchInfo.opponent, inline: true },
        { name: "Competition", value: matchInfo.competition, inline: true },
      ],
      footer: { text: "Jude Bellingham Match Tracker" },
      timestamp: new Date().toISOString(),
    };
  } else {
    embed = {
      title: "⚽ Jude Bellingham - Real Madrid",
      description: "No matches scheduled in the near future.",
      color: 0x2f3136,
      thumbnail: {
        url: "https://images.unsplash.com/photo-1548381528-7e459e3e2d4a?w=200",
      },
      timestamp: new Date().toISOString(),
    };
  }

  console.log("Embed payload:", JSON.stringify(embed, null, 2));

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Discord webhook failed for Bellingham embed: ${res.status} - ${text}`,
    );
  }

  console.log("Sent Jude Bellingham embed to Discord successfully.");
}
