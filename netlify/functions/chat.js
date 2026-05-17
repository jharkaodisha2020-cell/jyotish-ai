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
    const isChat = !!(body.system);

    if(isChat){
      const openaiKey = process.env.OPENAI_API_KEY;
      if(!openaiKey) return await callClaude(body, headers);

      const isPaid = body.paid === true;
      // Use valid OpenAI model names
      const model = isPaid ? 'gpt-4o' : 'gpt-4o-mini';

      const messages = [];
      if(body.system) messages.push({ role:'system', content: body.system });
      (body.messages||[]).forEach(m => messages.push({ role: m.role, content: m.content }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + openaiKey
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: body.max_tokens || 1500,
          temperature: 0.7
        })
      });

      const data = await response.json();

      if(data.error){
        console.error('OpenAI error:', JSON.stringify(data.error));
        return await callClaude(body, headers);
      }

      const text = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';

      // Return in Claude format so frontend works unchanged
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          content: [{ type: 'text', text: text || '' }],
          model_used: model
        })
      };

    } else {
      // Kundli JSON generation → Claude Haiku (fast, structured)
      return await callClaude(body, headers);
    }

  } catch(e){
    console.error('Function error:', e.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: { message: e.message } })
    };
  }
};

async function callClaude(body, headers){
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return {
    statusCode: 200, headers,
    body: JSON.stringify({ content:[{ type:'text', text:'API key not configured.' }] })
  };

  const isChat = !!(body.system);
  const claudeBody = {
    model: isChat ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(body.max_tokens || 1000, isChat ? 1500 : 900),
    messages: body.messages || []
  };
  if(body.system) claudeBody.system = body.system;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(claudeBody)
  });

  const data = await response.json();
  return { statusCode: 200, headers, body: JSON.stringify(data) };
}
