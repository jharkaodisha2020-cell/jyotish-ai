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
      body: JSON.stringify({
        content:[{type:'text',text:'ANTHROPIC_API_KEY not set in Netlify environment variables.'}]
      })
    };
  }

  try{
    const body = JSON.parse(event.body);
    // Force correct model + cap tokens to avoid timeout
    body.model = 'claude-sonnet-4-6';
    if(!body.max_tokens || body.max_tokens > 1500) body.max_tokens = 1000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 24000); // 24s timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await response.json();

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  }catch(e){
    const isTimeout = e.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 500,
      headers,
      body: JSON.stringify({
        error: {
          message: isTimeout ? 'Request timed out. Please try again.' : e.message
        }
      })
    };
  }
};
