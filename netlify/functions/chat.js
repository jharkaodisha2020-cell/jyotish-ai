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

  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, headers, body: JSON.stringify({error:{message:'Method not allowed'}}) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if(!apiKey){
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        content:[{type:'text',text:'API key not set. Go to Netlify → Site configuration → Environment variables → Add ANTHROPIC_API_KEY → Redeploy.'}]
      })
    };
  }

  try{
    const body = JSON.parse(event.body);

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

    // If model not found retry with stable model
    if(data.error && (data.error.type === 'not_found_error' || data.error.type === 'invalid_request_error')){
      const retry = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({...body, model:'claude-3-5-sonnet-20241022'})
      });
      const retryData = await retry.json();
      return { statusCode: 200, headers, body: JSON.stringify(retryData) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  }catch(e){
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({error:{message:e.message}})
    };
  }
};
