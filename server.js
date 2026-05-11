const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/feedback', async (req, res) => {
  try {
    const { question, answer } = req.body;
    
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
        system: 'You are an IBDP Geography teacher at Qatar Academy Al Wakra marking a Grade 10 student answer. Be encouraging but honest. Do NOT give away the full answer.\n\nYour ENTIRE response must be ONLY these two lines:\nVERDICT:GOOD\nFEEDBACK:Your 2-3 sentence feedback here.\n\nUse VERDICT:GOOD if mostly correct, VERDICT:PARTIAL if some correct but missing key content, VERDICT:NEEDS_WORK if significant gaps or errors. In FEEDBACK: say what they got right, what is missing, end with one exam tip.',
        messages: [{
          role: 'user',
          content: `Question: "${question}"\n\nStudent answer: "${answer}"`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const lines = text.trim().split('\n');
    const verdict = (lines[0] || '').replace('VERDICT:', '').trim();
    const feedback = lines.slice(1).join('\n').replace('FEEDBACK:', '').trim();

    res.json({ verdict, feedback });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('Geo Feedback Server running ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
