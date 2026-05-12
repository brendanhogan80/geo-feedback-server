const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/feedback', async (req, res) => {
  const { question, answer, mode } = req.body;

  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: 'No answer provided' });
  }

  try {
    let systemPrompt, userPrompt;

    if (mode === 'fix_dictation') {
      // Clean up speech-to-text errors only — do not add knowledge or improve content
      systemPrompt = `You are a speech-to-text error corrector for a Geography student app. 
Your ONLY job is to fix transcription errors caused by the speech recognition software.
Rules:
- Fix wrong words that sound similar (e.g. "ledger" → "leisure", "berth rate" → "birth rate")
- Fix broken phrases and missing words that were clearly cut off
- Fix punctuation and capitalisation
- Do NOT add any geographical knowledge, facts, or examples that the student did not say
- Do NOT expand, improve, or elaborate on the student's answer in any way
- Do NOT change the meaning or content — only fix the transcription
- Return ONLY the corrected text, nothing else. No explanation, no preamble.`;

      userPrompt = `Fix the speech-to-text transcription errors in this Geography student answer:\n\n"${answer}"`;

    } else {
      // Standard feedback mode
      systemPrompt = `You are an experienced IB Geography examiner marking student answers. 
Provide concise, constructive feedback using IB Geography assessment criteria.
Structure your response as:
VERDICT: [GOOD / PARTIAL / NEEDS_WORK]
FEEDBACK: [2-4 sentences of specific, actionable feedback]
Focus on: command term addressed, geographic concepts, use of examples, and depth of analysis.`;

      userPrompt = `Question: ${question}\n\nStudent answer: ${answer}\n\nMark this answer and provide feedback.`;
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const responseText = message.content[0].text;

    if (mode === 'fix_dictation') {
      return res.json({ feedback: responseText, verdict: 'FIXED' });
    }

    // Parse verdict from standard feedback
    const verdictMatch = responseText.match(/VERDICT:\s*(GOOD|PARTIAL|NEEDS_WORK)/i);
    const feedbackMatch = responseText.match(/FEEDBACK:\s*([\s\S]+)/i);
    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : 'PARTIAL';
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : responseText;

    res.json({ verdict, feedback });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
