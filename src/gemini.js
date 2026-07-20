const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function resolveRedirectUrl(redirectUrl) {
  try {
    const response = await fetch(redirectUrl, {
      method: 'HEAD',
      redirect: 'follow'
    });
    return response.url;
  } catch (err) {
    console.error(`Failed to resolve redirect: ${err.message}`);
    return redirectUrl; // Return original if resolution fails
  }
}

async function callGemini(prompt, useSearch = false) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing env: GEMINI_API_KEY");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const requestBody = {
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
  };

  if (useSearch) {
    requestBody.tools = [{ googleSearch: {} }];
    delete requestBody.generationConfig.responseMimeType;
  }

  const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
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

  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonText);
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
If multiple qualify, choose one randomly but prioritize the most recent one.

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

export async function checkJudeBellinghamMatch() {
  try {
    const result = await callGemini(`
Using Google Search, find out if Jude Bellingham (Real Madrid) has any football matches scheduled in the near future.

Return JSON only:
{
  "hasMatch": true or false,
  "matchDate": "date and time of next match, or null if no match soon",
  "opponent": "opposing team name, or null",
  "competition": "competition name (La Liga, Champions League, etc.), or null"
}

Be specific and accurate with dates and times.`, true);

    if (result.hasMatch === undefined) {
      console.error("Gemini returned invalid Bellingham data:", JSON.stringify(result));
      return { error: true, message: "Failed to retrieve match info." };
    }

    return result;
  } catch (err) {
    console.error("Jude Bellingham match check failed:", err.message);
    return { error: true, message: "Failed to retrieve match info: Gemini API error." };
  }
}
