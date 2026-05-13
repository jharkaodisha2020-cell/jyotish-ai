exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if(event.httpMethod === 'OPTIONS'){
    return { statusCode: 200, headers, body: '' };
  }

  try{
    const body = JSON.parse(event.body);
    const isChat = !!(body.system); // has system prompt = chat request

    if(isChat){
      // ── CHAT: Use OpenAI GPT-4o ──
      const openaiKey = process.env.OPENAI_API_KEY;
      if(!openaiKey){
        // Fallback to Claude if no OpenAI key
        return await callClaude(body, event, headers);
      }

      // Convert Claude format → OpenAI format
      const messages = [];
      if(body.system){
        messages.push({ role: 'system', content: body.system });
      }
      (body.messages||[]).forEach(m => {
        messages.push({ role: m.role, content: m.content });
      });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + openaiKey
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: messages,
          max_tokens: body.max_tokens || 1500,
          temperature: 0.7
        })
      });

      const data = await response.json();
      if(data.error){
        // Fallback to Claude on OpenAI error
        return await callClaude(body, event, headers);
      }

      // Convert OpenAI response → Claude format (so app works without changes)
      const text = data.choices?.[0]?.message?.content || '';
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          content: [{ type: 'text', text }]
        })
      };

    } else {
      // ── KUNDLI JSON: Use Claude Haiku (fast + cheap) ──
      return await callClaude(body, event, headers);
    }

  }catch(e){
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: { message: e.message } })
    };
  }
};

async function callClaude(body, event, headers){
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if(!anthropicKey){
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content: [{ type: 'text', text: 'API key not configured.' }] })
    };
  }

  const isChat = !!(body.system);
  body.model = isChat ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  body.max_tokens = Math.min(body.max_tokens || 1000, isChat ? 1500 : 900);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return { statusCode: 200, headers, body: JSON.stringify(data) };
}
