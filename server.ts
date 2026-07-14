/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';


dotenv.config();

// Ensure Mistral API key is configured
const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  console.warn('Warning: MISTRAL_API_KEY is not defined in the environment. AI extraction will run in fallback mock mode.');
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiMode: apiKey ? 'mistral-active' : 'fallback-simulation',
    time: new Date().toISOString(),
  });
});

// AI SURVEY TRANSCRIPT EXTRACTION ENDPOINT
app.post('/api/survey/process-transcript', async (req, res) => {
  const { transcript, currentAnswers, transcriptHistory } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'Missing transcript field' });
  }

  if (!apiKey) {
    console.warn('Mistral API key missing. Cannot process transcript.');
    return res.status(503).json({
      extractedFields: [],
      speaker: 'Unknown',
      reasoning: 'AI Engine unavailable. Please configure MISTRAL_API_KEY in Settings.'
    });
  }

  try {
    const prompt = `
You are an advanced AI engine powering a NABARD Village Survey speech processing pipeline.
Your respondents are rural women from Haryana. They speak Haryanvi, Hindi, Hinglish, and mixed sentences with heavy local accents and idioms.

CRITICAL DIRECTIVE: You must act as a strict 2-stage processing pipeline.
STAGE 1: Normalization (Haryanvi -> Standard Hindi)
STAGE 2: Extraction & Mapping (Standard Hindi -> Structured Schema)

You MUST follow these strict engineering requirements to extract data deterministically:

1. HARYANVI LANGUAGE LAYER (Normalization)
Always normalize Haryanvi expressions into standard meaning before mapping.
Examples:
- "mhare", "hamare", "mere te", "mujhse" -> me / my
- "ke", "kya" -> what
- "konya", "nahi", "ber koni", "pata nahi", "na se", "na bhai" -> NO
- "haan", "haan ji", "kar le se", "ho se", "theek se" -> YES
- "ghana", "bahut" -> much/high
- "ib", "ab", "fer", "phir" -> now / then
- "ghar aale" -> family
- "chhora" -> boy/son, "chhori" -> girl/daughter
- "khet mein jaa su" -> I work on farm
- "mera aadmi" -> husband, "sasra" -> father-in-law, "saasu" -> mother-in-law

2. CONTEXTUAL UNDERSTANDING & INDIRECT ANSWERS
Do NOT merely look for literal word matches.
- Example: Q: "Do you own agricultural land?" A: "Sab aadmi ke naam pe hai." -> owns_agricultural_land: true, land_registered_name: "husband"
- Example: Q: "Who takes farming decisions?" A: "Ghar mein bade hi faisla karte hain." -> farm_decision_maker: "Father in law"
- Example: Q: "How many children?" A: "Ek chhora aur do chhori." -> dependents_count: 3 (auto-infer details in reasoning).
- Example: Q: Land Ownership -> "Mere naam kuch bhi na hai." -> land_in_own_name: false. "Joint naam se hai." -> land_registered_name: "jointly".

3. MULTIPLE ACTIVITY INFERENCE
For checklists (like farm activities), infer naturally.
Example: "Main bowaai bhi karti hu katayi bhi aur pashu bhi sambhalti hu" -> "Sowing/transplanting", "Harvesting", "Livestock management". Do not wait for separate Yes/No.

4. NUMBERS AND FINANCES
Recognize spoken numbers naturally: "do" (2), "teen" (3), "sawa do" (2.25), "dedh" (1.5), "pone teen" (2.75), "pachpan" (55), "bees ek" (20 or 21), "saath" (60).
For wages, allow approximate ranges (e.g., "Koi 300 ke aas paas" -> 300).
For income, normalize daily, weekly, monthly, or seasonal into annual estimates while keeping the original response.

5. MIGRATION & DECISIONS
- "Mera aadmi Gurgaon mein kaam kare se" -> adult_male_migrated: true, migrated_relation: "husband", migrated_destination: "other state".
- Decision making power (Q28): "Ab meri bhi chalti hai." / "Thodi bahut." / "Sab sasur dekhte hain." -> mapped to boolean or text as required.

6. GOVERNMENT SCHEMES
Recognize mispronounced schemes: PM Kisan, KCC, Ayushman, SHG, FPO, MNREGA, Ujjwala, PM Awas, Jan Dhan, Lakhpati Didi, NABARD, etc.

7. ZERO HALLUCINATION POLICY & CONFIDENCE RULES
- Assign confidence (0.0 to 1.0).
- >= 0.95: Auto-fill (green).
- 0.80 to 0.94: Needs verification (yellow).
- < 0.80: Ask interviewer to confirm (red/yellow).
- NEVER guess. If the speech is unrelated or unclear, return an empty array for extractedFields.

Inputs:
1. "New Transcript Segment": "${transcript}"
2. "Prior Conversation History": ${JSON.stringify(transcriptHistory || [])}
3. "Current Field Answers": ${JSON.stringify(currentAnswers || {})}

Your Task:
Map the conversation to predefined fields. If information for ANY field is provided, extract it even if out of order.

Predefined Fields Logic:
- Boolean: "haan"/"konya" -> true/false
- Multi-selects/Selects: map to the closest standard option.

Return JSON EXACTLY as follows:
{
  "extractedFields": [
    {
      "fieldId": "exact_question_id",
      "value": "normalized value (boolean, string, or array)",
      "confidence": 0.95,
      "sourceSnippet": "exact sub-string from transcript",
      "status": "green" // green if >=0.95, yellow if 0.80-0.94, red if <0.80
    }
  ],
  "speaker": "Enumerator" | "Respondent" | "Unknown",
  "reasoning": "Explain Haryanvi translation and inference logic."
}
`;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mistral API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const parsedData = JSON.parse(data.choices[0].message.content || '{}');
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Mistral processing error:', error);
    return res.status(500).json({
      extractedFields: [],
      speaker: 'Unknown',
      reasoning: 'Error connecting to Mistral API.',
      error: error.message,
    });
  }
});

// SETUP VITE DEVELOPMENT OR STATIC PRODUCTION SERVING
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NABARD Survey Assistant Server running on http://0.0.0.0:${PORT}`);
    if (apiKey) {
      console.log('Mistral AI features are enabled and connected.');
    } else {
      console.log('Running in local offline simulation mode for AI extraction.');
    }
  });
}

startServer();
