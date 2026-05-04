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

    // Use haiku for kundli JSON generation (fast, structured)
    // Use sonnet for chat (better quality)
    const isChatMsg = body.messages && body.messages.length > 1;
    body.model = isChatMsg ? 'claude-haiku-4-5-20251001' : 'claude-haiku-4-5-20251001';

    // Hard cap tokens - keep response fast
    body.max_tokens = Math.min(body.max_tokens || 800, 800);

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
