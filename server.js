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
    const { question, answer, otherAnswers, mode } = req.body;
    if (!answer || !answer.trim()) return res.status(400).json({ error: 'Missing answer' });

    let systemPrompt, userPrompt;

    if (mode === 'fix_dictation') {
      systemPrompt = `You are a speech-to-text transcription cleaner. You receive garbled text from voice recognition and return ONLY the corrected transcription.\n\nSTRICT RULES:\n1. Return ONLY the cleaned text. No preamble, explanation, suggestions, or feedback.\n2. NEVER add words, facts, or ideas not in the original.\n3. NEVER comment on the answer quality or completeness.\n4. NEVER give exam or study advice.\n5. If text cuts off mid-sentence, return it cut off - do not complete it.\n6. Only fix: wrong homophones, misheard words, speech-recognition errors, basic punctuation.\n\nOutput: corrected text only.`;
      userPrompt = `Fix this speech-to-text transcription. Return only the corrected text:\n\n${answer}`;

    } else if (mode === 'check_authenticity') {
      systemPrompt = `You are an experienced teacher checking if a student's answer appears to be their own work or AI-generated/copied. You will be given one answer and optionally some of the student's other answers for comparison.\n\nRespond in exactly this format:\nVERDICT: [CONSISTENT or INCONSISTENT or UNCERTAIN]\nFEEDBACK: [One sentence explanation for the teacher]\n\nCRITERIA:\n- CONSISTENT: vocabulary, sentence structure, and depth are similar to the student's other answers\n- INCONSISTENT: significantly more sophisticated, perfectly structured, or written in a noticeably different style than the student's other work\n- UNCERTAIN: not enough other answers to compare, or ambiguous\n\nIMPORTANT: Be fair. A good answer is not automatically suspicious. Only flag if there is clear evidence of inconsistency.`;
      const comparison = otherAnswers && otherAnswers.length > 0
        ? `\n\nFor comparison, here are ${otherAnswers.length} other answers from the same student:\n${otherAnswers.map((a, i) => `[${i + 1}] ${a}`).join('\n\n')}`
        : '\n\nNo other answers available for comparison.';
      userPrompt = `Answer to check:\n"${answer}"${comparison}`;

    } else {
      systemPrompt = `You are a supportive IBDP Geography teacher giving feedback to a 16-18 year old student. Your job is to guide them towards a better answer, not just tell them they are wrong.

Your ENTIRE response must be ONLY these two lines, nothing else:
VERDICT:GOOD
FEEDBACK:Your feedback here.

VERDICT rules:
- GOOD: answer is mostly correct and shows understanding
- PARTIAL: some correct ideas but missing key content or depth
- NEEDS_WORK: significant gaps, misconceptions, or too vague

FEEDBACK rules (2-3 sentences):
1. Always start by acknowledging what they got RIGHT, even if it is small
2. Then give a SPECIFIC HINT towards what is missing — point them in the right direction without giving the full answer away. For example: "Think about how X affects Y..." or "Consider adding an example of..." or "Try to explain WHY, not just WHAT..."
3. End with ONE encouraging phrase that motivates them to try again

Never say "you are wrong" or "incorrect". Be warm, specific, and constructive. The student should finish reading feeling like they can improve, not like they have failed.`;
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

    if (mode === 'check_authenticity') {
      const vMatch = text.match(/VERDICT:\s*(CONSISTENT|INCONSISTENT|UNCERTAIN)/i);
      const fMatch = text.match(/FEEDBACK:\s*(.+)/i);
      const verdict = vMatch ? vMatch[1].toUpperCase() : 'UNCERTAIN';
      const feedback = fMatch ? fMatch[1].trim() : text.trim();
      return res.json({ verdict, feedback });
    }

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
