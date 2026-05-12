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
      systemPrompt = `You are a speech-to-text transcription cleaner. You receive garbled text produced by voice recognition software and return ONLY the corrected transcription.

STRICT RULES — violating any of these is a failure:
1. Return ONLY the cleaned text. No preamble, no explanation, no suggestions, no feedback.
2. NEVER add words, facts, examples, or ideas that were not in the original.
3. NEVER comment on whether the answer is complete, good, or needs improvement.
4. NEVER give advice about exams, writing, or study.
5. If the text is incomplete or cuts off mid-sentence, return it as-is after fixing transcription errors — do not complete it.
6. Only fix: wrong homophones, misheard words, obvious speech-recognition substitutions, and basic punctuation.

Output format: the corrected text and nothing else.`;

      userPrompt = `Clean up this speech-to-text transcription. Return only the corrected text:\n\n${answer}`;

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
