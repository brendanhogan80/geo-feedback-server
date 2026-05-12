const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
app.use(express.json());

console.log('API key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));

app.post('/feedback', async (req, res) => {
  try {
    const { question, answer, mode } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ error: 'Missing answer' });

    let systemPrompt, userPrompt;

    if (mode === 'fix_dictation') {
      systemPrompt = `You are a speech-to-text transcription cleaner. You receive garbled text from voice recognition and return ONLY the corrected transcription.\n\nSTRICT RULES:\n1. Return ONLY the cleaned text. No preamble, explanation, suggestions, or feedback.\n2. NEVER add words, facts, or ideas not in the original.\n3. NEVER comment on the answer quality or completeness.\n4. NEVER give exam or study advice.\n5. If text cuts off mid-sentence, return it cut off - do not complete it.\n6. Only fix: wrong homophones, misheard words, speech-recognition errors, basic punctuation.\n\nOutput: corrected text only.`;
      userPrompt = `Fix this speech-to-text transcription. Return only the corrected text:\n\n${answer}`;
    } else {
      systemPrompt = `You are an IBDP Geography teacher marking a student answer. Be encouraging but honest. Do NOT give away the full answer.\n\nYour ENTIRE response must be ONLY these two lines, nothing else:\nVERDICT:GOOD\nFEEDBACK:Your 2-3 sentence feedback here.\n\nUse VERDICT:GOOD if mostly correct, VERDICT:PARTIAL if some correct but missing key content, VERDICT:NEEDS_WORK if significant gaps or errors. In FEEDBACK: say what they got right, what is missing, end with one exam tip.`;
      userPrompt = `Question: "${question}"\n\nStudent answer: "${answer}"`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data));
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.[0]?.text || '';

    if (mode === 'fix_dictation') return res.json({ feedback: text.trim(), verdict: 'FIXED' });

    const lines = text.trim().split('\n');
    const verdictLine = lines.find(l => l.startsWith('VERDICT:')) || 'VERDICT:PARTIAL';
    const feedbackLine = lines.find(l => l.startsWith('FEEDBACK:')) || 'FEEDBACK:Please try again.';
    res.json({ verdict: verdictLine.replace('VERDICT:', '').trim(), feedback: feedbackLine.replace('FEEDBACK:', '').trim() });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('EazyGrade Feedback Server running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
