import axios from 'axios';

export class OpenRouterError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

const RATING_SYSTEM_PROMPT = `You are an expert sales call evaluator. 
You will receive a diarized transcript of a sales call
Analyze it carefully and return ONLY valid JSON (no markdown, no prose) matching this exact schema:

{
  "overallScore": number, // 0-100, integer
  "summary": string, // 2-3 sentence overall summary
  "criteria": [
    { "name": string, "score": number, "max": 10, "reasoning": string }
  ],
  "strengths": string[],
  "improvements": string[],
  "speakerInsights": [
    { "speaker": string, "talkSharePct": number, "notes": string }
  ]
}

Evaluate strictly on these 5 criteria (each scored 0-10):
1. "Opening & Rapport" — Did the rep introduce themselves, build trust, and open warmly?
2. "Needs Discovery" — Did the rep ask thoughtful, open-ended questions to uncover pain points?
3. "Value Proposition" — Did the rep clearly articulate product/service benefits tailored to the customer?
4. "Objection Handling" — Did the rep address concerns with empathy, clarity, and solid reasoning?
5. "Closing & Next Steps" — Did the rep summarize, confirm interest, and lock in a clear follow-up?

Be specific and reference actual lines from the transcript in your reasoning.`;

export async function rateTranscript({ transcript, apiKey, model }) {
  if (!apiKey) throw new OpenRouterError('OPENROUTER_API_KEY is not set');
  if (!transcript || !transcript.trim()) {
    throw new OpenRouterError('Empty transcript provided', 400);
  }

  const usedModel = model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: usedModel,
      messages: [
        { role: 'system', content: RATING_SYSTEM_PROMPT },
        { role: 'user', content: `Diarized transcript:\n\n${transcript}` },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      usage: { include: true },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new OpenRouterError('No content from OpenRouter');

  let rating;
  try {
    rating = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new OpenRouterError('Model returned non-JSON content');
    rating = JSON.parse(match[0]);
  }

  const usage = response.data?.usage || null;

  return {
    rating,
    meta: {
      model: response.data?.model || usedModel,
      id: response.data?.id,
      provider: response.data?.provider,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
            cost: typeof usage.cost === 'number' ? usage.cost : null,
            costDetails: usage.cost_details || null,
          }
        : null,
    },
  };
}
