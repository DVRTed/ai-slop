import "dotenv/config";
import { fetch_talk_threads } from "./parse_talk.js";
import { analyzeANI, analyzeUSR, fetchHantavirusUpdate, fetchTopBreakingNews } from "./gemini.js";
import { generateANIImage, generateUSRImage } from "./image.js";
import { sendToDiscord, sendNewsEmbed } from "./discord.js";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PAGES = {
  ANI: "Wikipedia:Administrators' noticeboard/Incidents",
  USR: "Wikipedia:User scripts/Requests",
};

async function main() {
  if (!DISCORD_WEBHOOK_URL) {
    throw new Error("Missing env: DISCORD_WEBHOOK_URL");
  }

  console.log("Fetching Wikipedia pages with DiscussionTools...");
  const [aniThreads, usrThreads] = await Promise.all([
    fetch_talk_threads(PAGES.ANI),
    fetch_talk_threads(PAGES.USR),
  ]);

  console.log(
    `ANI: ${aniThreads.length} threads | USR: ${usrThreads.length} threads`,
  );

  console.log("Asking Gemini for ANI...");
  const incidents = await analyzeANI(aniThreads);

  console.log("Asking Gemini for USR...");
  const requests = await analyzeUSR(usrThreads);
  console.log(
    `Got ${incidents?.length || 0} incidents, ${requests?.length || 0} requests`,
  );

  console.log("Generating images...");
  const [aniImage, usrImage] = await Promise.all([
    generateANIImage(incidents || []),
    generateUSRImage(requests || []),
  ]);

  console.log("Sending images to Discord...");
  await sendToDiscord(DISCORD_WEBHOOK_URL, aniImage, usrImage);

  console.log("Asking Gemini for hantavirus update...");
  const hantavirus = await fetchHantavirusUpdate();

  console.log("Asking Gemini for top breaking news...");
  const news = await fetchTopBreakingNews();

  console.log("Sending news embed to Discord...");
  await sendNewsEmbed(DISCORD_WEBHOOK_URL, hantavirus, news);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
