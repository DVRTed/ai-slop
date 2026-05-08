const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing env: GEMINI_API_KEY");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "Respond with valid JSON only. Do not add any explanation, notes, or extra fields.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Gemini API error (${url}): ${res.status} ${res.statusText}: ${body}`,
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Missing Gemini response content");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.substring(0, 200)}`);
  }
}

function compileThreadsForPrompt(threads) {
  return threads
    .map((thread) => {
      const commentsText = thread.comments
        .map((c) => `${c.author}: ${c.text}`)
        .join("\n");
      return `### ${thread.title}\n${commentsText}`;
    })
    .join("\n\n---\n\n")
    .trim();
}

export async function analyzeANI(threads) {
  const promptText = compileThreadsForPrompt(threads);

  console.log(
    `ANI prompt size: ${promptText.length} chars (~${Math.round(promptText.length / 4)} tokens)`,
  );
  const { incidents } = await callGemini(`
You are reviewing WP:ANI sections.
Choose the 4 most interesting incidents by conflict, heat, or many editors.

Return JSON only:
{ "incidents": [ ... ] }
Each item:
{
  "title": "exact section title",
  "summary": "3-5 sentences: who is involved, what the dispute is, and why it is heated",
  "dramaScore": 1 | 2 | 3,
  "participants": ["up to 4 usernames mentioned in the section"],
  "outcome": "very brief summary of what action was taken, if any; if it's ongoing or unresolved, say so."
}

SECTIONS:
${promptText}`);

  return incidents;
}

export async function analyzeUSR(threads) {
  const promptText = compileThreadsForPrompt(threads);

  console.log(
    `USR prompt size: ${promptText.length} chars (~${Math.round(promptText.length / 4)} tokens)`,
  );
  const { requests } = await callGemini(`
You are reviewing WP:US/R sections.
Select exactly one request that is truly ignored and unresolved.
If multiple qualify, choose one randomly.

Skip any section if it contains:
- a script, code sample, or workaround suggestion
- a direct fix, answer, or "try X" instruction
- thanks, resolution, or confirmation that the requester got a solution

Return JSON only:
{ "requests": [ ... ] }
Each item:
{
  "title": "exact section title",
  "description": "concise technical summary of the requested feature or script",
  "details": "short technical context or requirements, no fluff",
  "status": "ignored",
  "difficulty": "Easy" | "Medium" | "Hard",
  "timeEstimate": "e.g. '1-2 hours', 'A few days'"
}

Notes:
- description should be concise but meaningful, with relevant technical terms.
- return only one request, or an empty array if none qualify.

SECTIONS:
${promptText}`);

  console.log("called for usr");
  return requests;
}

export async function fetchHantavirusUpdate() {
  const today = new Date().toISOString().split("T")[0];
  const { hantavirus } = await callGemini(`
Today is ${today}.
What are the current global hantavirus stats and situation as of today?
Include: total known cases this year, recent outbreaks, affected regions, fatality rate, and any notable developments.
If you don't have exact numbers for today, provide the most recent known data and note the date.

Return JSON only:
{
  "hantavirus": {
    "summary": "2-4 sentence overview of the current hantavirus situation globally",
    "lastUpdated": "the date of the most recent data you have"
  }
}`);

  return hantavirus;
}

export async function fetchTopBreakingNews() {
  const today = new Date().toISOString().split("T")[0];
  const { news } = await callGemini(`
Today is ${today}.
What is the single BIGGEST, most significant breaking news story in the world today?
Pick only ONE story that is the most impactful globally.

Return JSON only:
{
  "news": {
    "title": "headline of the news story",
    "description": "2-3 sentence summary of what happened and why it matters",
    "sources": [
      { "name": "outlet name eg CNN, BBC, Reuters", "url": "direct URL to their article about this story" },
      { "name": "outlet name", "url": "direct URL" },
      { "name": "outlet name", "url": "direct URL" }
    ]
  }
}

Provide at least 3 credible news sources with real, direct URLs to articles about this story.`);

  return news;
}
