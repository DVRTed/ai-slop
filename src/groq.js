import Groq from "groq-sdk";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_OUTPUT_TOKENS = 3000;
const MAX_INPUT_CHARS = 28000;
const groq = new Groq();

async function callGroq(prompt, maxTokens = GROQ_OUTPUT_TOKENS) {
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Respond with valid JSON only. Do not add any explanation, notes, or extra fields.",
      },
      { role: "user", content: prompt },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

function compileThreadsForPrompt(threads, maxCommentsPerThread) {
  let result = [];
  let currentChars = 0;

  for (let i = threads.length - 1; i >= 0; i--) {
    let threadComments = threads[i].comments;

    if (threadComments.length > maxCommentsPerThread) {
      const keepHalf = Math.floor(maxCommentsPerThread / 2);
      threadComments = [
        ...threadComments.slice(0, keepHalf),
        {
          author: "System",
          text: `...[${threadComments.length - maxCommentsPerThread} comments collapsed]...`,
        },
        ...threadComments.slice(-keepHalf),
      ];
    }

    const commentsText = threadComments.map((c) => `${c.author}: ${c.text}`).join("\n");
    const text = `### ${threads[i].title}\n${commentsText}`;

    if (currentChars + text.length > MAX_INPUT_CHARS) {
      if (result.length === 0) {
        result.unshift(text.substring(0, MAX_INPUT_CHARS) + "\n...[TRUNCATED]");
      }
      break;
    }

    result.unshift(text);
    currentChars += text.length;
  }

  return result.join("\n\n---\n\n").trim();
}

export async function analyzeANI(threads) {
  const promptText = compileThreadsForPrompt(threads, 10);

  const { incidents } = await callGroq(`
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
  "outcome": "exact outcome, or null if unknown"
}

SECTIONS:
${promptText}`);

  return incidents;
}

export async function analyzeUSR(threads) {
  const promptText = compileThreadsForPrompt(threads, 10);
  console.log(`Sending USR prompt with length ${promptText.length}`);

  const { requests } = await callGroq(`
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
