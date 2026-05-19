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
      if(!openaiKey){
        console.log('No OpenAI key, using Claude');
        return await callClaude(body, headers);
      }

      const isPaid = body.paid === true;
      // Use safe proven model names
      const model = isPaid ? 'gpt-4o' : 'gpt-4o-mini';

      const messages = [];
      if(body.system) messages.push({ role:'system', content: body.system });
      (body.messages||[]).forEach(m => messages.push({ role: m.role, content: m.content }));

      let response;
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + openaiKey
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: Math.min(body.max_tokens || 1500, 2000),
            temperature: 0.7
          })
        });
      } catch(fetchErr) {
        console.error('OpenAI fetch failed:', fetchErr.message);
        return await callClaude(body, headers);
      }

      // Read response as text first to avoid JSON parse errors
      const rawText = await response.text();

      // Check if it's HTML (error page)
      if(rawText.trim().startsWith('<') || rawText.trim().startsWith('<!')) {
        console.error('OpenAI returned HTML, status:', response.status);
        return await callClaude(body, headers);
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch(parseErr) {
        console.error('OpenAI JSON parse failed:', rawText.substring(0, 200));
        return await callClaude(body, headers);
      }

      if(data.error) {
        console.error('OpenAI error:', data.error.code, data.error.message);
        return await callClaude(body, headers);
      }

      const text = (data.choices && data.choices[0] && data.choices[0].message)
        ? (data.choices[0].message.content || '')
        : '';

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          content: [{ type: 'text', text: text }],
          model_used: model
        })
      };

    } else {
      // Kundli JSON → Claude Haiku
      return await callClaude(body, headers);
    }

  } catch(e) {
    console.error('Handler error:', e.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        content: [{ type: 'text', text: 'Server error: ' + e.message }]
      })
    };
  }
};

async function callClaude(body, headers) {
  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return {
    statusCode: 200, headers,
    body: JSON.stringify({ content:[{ type:'text', text:'No API key configured.' }] })
  };

  const isChat = !!(body.system);
  const claudeBody = {
    model: isChat ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(body.max_tokens || 1000, isChat ? 1500 : 900),
    messages: (body.messages || []).map(m => ({ role: m.role, content: m.content }))
  };
  if(body.system) claudeBody.system = body.system;

  try {
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
  } catch(e) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content:[{ type:'text', text:'Claude error: ' + e.message }] })
    };
  }
}
