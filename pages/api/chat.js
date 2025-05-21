import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, threadId } = req.body;

    // 添加用户消息到线程
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // 运行助手
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // 检查运行状态
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // 获取助手回复
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessages = messages.data.filter(m => m.role === 'assistant');
    
    if (assistantMessages.length > 0) {
      const reply = assistantMessages[0].content[0].text.value;
      return res.status(200).json({ reply });
    } else {
      throw new Error('No assistant response received');
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ 
      error: 'Disculpa, estoy teniendo dificultades. ¿Podrías intentarlo de nuevo?'
    });
  }
}