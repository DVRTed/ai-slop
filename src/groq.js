import Groq from "groq-sdk";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_OUTPUT_TOKENS = 3000;
const MAX_INPUT_CHARS = 28000;
const groq = new Groq();

async function callGroq(prompt, maxTokens = GROQ_OUTPUT_TOKENS) {
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
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
You are a Wikipedia drama analyst reviewing WP:ANI sections.

Pick the 4 most interesting or contentious incidents. Prioritize ones with many editors involved or heated back-and-forth.

Return JSON: { "incidents": [ ... ] }
Each item:
{
  "title": "exact section title",
  "summary": "3-5 sentences: who is involved, what the dispute is about, why it is heated",
  "dramaScore": <1, 2, or 3>,
  "participants": ["up to 4 editor usernames mentioned in the section"],
  "outcome": "State the outcome and exactly who it affected (eg 'UserX blocked indefinitely', 'UserY warned'), or if it's unresolved or ongoing, state that. IF YOU CANNOT DETERMINE, return null" 
}

SECTIONS:
${promptText}`);

  return incidents;
}

export async function analyzeUSR(threads) {
  const promptText = compileThreadsForPrompt(threads, 10);
  console.log(`Sending USR prompt with length ${promptText.length}`);

  const { requests } = await callGroq(`
You are reviewing WP:US/R (Wikipedia:User scripts/Requests).

Find up to 5 requests that are truly UNANSWERED or UNRESOLVED. 
CRITICAL RULE: Do NOT include any requests where another editor has provided a script, a functional solution, a workaround, or a satisfying answer. If someone replied with a solution (even if it's not a script) and the requester expressed gratitude or marked it as resolved, it is COMPLETELY RESOLVED and must be fully skipped. Only select requests that are actively stranded and waiting for someone to help.

Return JSON: { "requests": [ ... ] }
Each item:
{
  "title": "exact section title",
  "description": "short description of what the editor is asking for",
  "status": "ignored" or "partial",
  "difficulty": "estimate of technical difficulty: 'Easy', 'Medium', or 'Hard'",
  "timeEstimate": "estimate of time required: e.g., '1-2 hours', 'A few days'"
}

SECTIONS:
${promptText}`);

  console.log("called for usr");
  return requests;
}
