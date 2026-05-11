const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());
app.use(express.json());
console.log('API key starts with:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));



app.post('/feedback', async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'Missing question or answer' });
    }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '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',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'You are an IBDP Geography teacher at Qatar Academy Al Wakra marking a Grade 10 student answer. Be encouraging but honest. Do NOT give away the full answer.\n\nYour ENTIRE response must be ONLY these two lines, nothing else:\nVERDICT:GOOD\nFEEDBACK:Your 2-3 sentence feedback here.\n\nUse VERDICT:GOOD if mostly correct, VERDICT:PARTIAL if some correct but missing key content, VERDICT:NEEDS_WORK if significant gaps or errors. In FEEDBACK: say what they got right, what is missing, end with one exam tip.',
        messages: [{
          role: 'user',
          content: `Question: "${question}"\n\nStudent answer: "${answer}"`
        }]
      })
    });
   const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data));
    if (data.error) {
      console.error('Anthropic error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }
    const text = data.content?.[0]?.text || '';
    const lines = text.trim().split('\n');
    const verdictLine = lines.find(l => l.startsWith('VERDICT:')) || 'VERDICT:PARTIAL';
    const feedbackLine = lines.find(l => l.startsWith('FEEDBACK:')) || 'FEEDBACK:Please try again.';
    const verdict = verdictLine.replace('VERDICT:', '').trim();
    const feedback = feedbackLine.replace('FEEDBACK:', '').trim();
    res.json({ verdict, feedback });
  } catch (err) {
    console.error('Server error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('Geo Feedback Server running ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
