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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if(!apiKey){
    return {
      statusCode: 200, headers,
      body: JSON.stringify({content:[{type:'text',text:'API key not configured.'}]})
    };
  }

  try{
    const body = JSON.parse(event.body);

    // Use haiku for structured JSON (kundli generation) - fast
    // Use sonnet for chat messages - richer, longer responses
    const isChat = body.messages && body.messages.length > 0 && body.system;
    
    if(isChat){
      // Chat: use sonnet for detailed responses
      body.model = 'claude-sonnet-4-6';
      body.max_tokens = Math.min(body.max_tokens || 1500, 1500);
    } else {
      // Kundli JSON generation: use haiku for speed
      body.model = 'claude-haiku-4-5-20251001';
      body.max_tokens = Math.min(body.max_tokens || 800, 900);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  }catch(e){
    return {
      statusCode: 500, headers,
      body: JSON.stringify({error:{message:e.message}})
    };
  }
};
