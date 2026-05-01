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
      body: JSON.stringify({content:[{type:'text',text:'ANTHROPIC_API_KEY not set in Netlify environment variables.'}]})
    };
  }

  try{
    const body = JSON.parse(event.body);
    // Always use correct stable model
    body.model = 'claude-3-5-sonnet-20241022';

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
