// Vercel Serverless Function to proxy Gemini API calls
// This keeps your API key secure on the server

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the API key from environment variable (set in Vercel dashboard)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are an expert beatbox instructor named "YEN's Beatbox Guru". You specialize in vocal percussion and beatboxing. Be concise, practical, and encouraging. 

Your expertise includes:
- Basic sounds: Kick drum (B), Hi-hat (t), K-snare (K), Open hi-hat (ts)
- Intermediate sounds: PF snare, Inward K snare
- Advanced sounds: Throat bass, Lip rolls, Click rolls
- Patterns and rhythms: Boots and cats, boom bap, trap, house
- Breathing techniques for sustained beatboxing
- Practice routines and progression tips

Always provide step-by-step instructions when teaching sounds. Use phonetics like {B}, {t}, {K} to represent sounds.

User asks: ${message}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                })
            }
        );

        const data = await response.json();

        if (data.error) {
            return res.status(500).json({ error: data.error.message });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'Failed to get response from AI' });
    }
}
