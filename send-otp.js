exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

  try{
    const { mobile, name } = JSON.parse(event.body);

    if(!mobile || mobile.length < 12){
      return { statusCode:200, headers,
        body: JSON.stringify({ success:false, message:'Invalid mobile number' }) };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP as base64 token (10 min expiry)
    const otpToken = Buffer.from(JSON.stringify({
      mobile, otp, name: name||'',
      expires: Date.now() + 10 * 60 * 1000
    })).toString('base64');

    const apiKey = process.env.APITXT_API_KEY;

    if(!apiKey){
      console.log('DEMO OTP:', otp);
      return { statusCode:200, headers, body: JSON.stringify({
        success:false, demo:true, demo_otp:otp, otp_token:otpToken,
        message:'API key missing. Demo OTP: ' + otp
      })};
    }

    // ApiTxt OTP API - only needs authkey, mobile, otp
    const message = encodeURIComponent(
      'Your Jyotish AI login OTP is ' + otp + '. Valid for 10 minutes. -JYOTSH'
    );
    const url = `https://apitxt.com/api/sendOTP?authkey=${apiKey}&mobile=${mobile}&otp=${otp}&message=${message}`;

    const res = await fetch(url);
    const raw = await res.text();
    console.log('ApiTxt response:', raw);

    let data;
    try{ data = JSON.parse(raw); }catch(e){ data = { raw }; }

    const success = data.return === true || data.return === 'true'
      || data.status === 'success' || raw.includes('"return":true');

    return { statusCode:200, headers, body: JSON.stringify({
      success,
      otp_token: otpToken,
      message: success ? 'OTP sent successfully' : ('SMS error: ' + raw)
    })};

  }catch(e){
    console.error('send-otp error:', e.message);
    return { statusCode:200, headers,
      body: JSON.stringify({ success:false, message: e.message }) };
  }
};
