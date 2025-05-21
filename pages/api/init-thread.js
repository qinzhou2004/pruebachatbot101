import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const thread = await openai.beta.threads.create();
    return res.status(200).json({ threadId: thread.id });
  } catch (error) {
    console.error('Error creating thread:', error);
    return res.status(500).json({ error: 'Error initializing chat' });
  }
}