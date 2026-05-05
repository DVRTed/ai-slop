# ai-slop

A bot that scrapes Wikipedia talk pages ([ANI](https://en.wikipedia.org/wiki/Wikipedia:Administrators%27_noticeboard/Incidents) and [US/R](https://en.wikipedia.org/wiki/Wikipedia:User_scripts/Requests)), sends them to **Gemini** for analysis, generates summary images, and posts them to a **Discord** channel via webhook.

## How it works

1. **Fetch** — Pulls active threads from Wikipedia talk pages using the [DiscussionTools API](https://www.mediawiki.org/wiki/Extension:DiscussionTools).
2. **Analyze** — Sends thread text to Google's Gemini API to pick out the most interesting incidents (ANI) or ignored requests (US/R).
3. **Render** — Generates PNG images: ANI cards via SVG + [sharp](https://sharp.pixelplumbing.com/), US/R cards via [node-canvas](https://github.com/Automattic/node-canvas).
4. **Post** — Uploads the images to Discord through a webhook.

## Prerequisites

- Node.js ≥ 18
- A [Gemini API key](https://aistudio.google.com/app/apikey)
- A [Discord webhook URL](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

## Setup

```bash
# Install dependencies
npm install

# Copy the example env file and fill in your values
cp .env.example .env
```

## Usage

```bash
npm start
```

## Project structure

```
src/
├── index.js        # Entrypoint — orchestrates the pipeline
├── parse_talk.js   # Fetches & flattens Wikipedia talk-page threads
├── gemini.js       # Gemini API calls and prompt definitions
├── image.js        # Image generation (SVG/sharp for ANI, canvas for US/R)
└── discord.js      # Discord webhook upload
```
