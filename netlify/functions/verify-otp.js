exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if(event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

  try{
    const { mobile, otp, name, otp_token } = JSON.parse(event.body);

    // Decode OTP token
    if(!otp_token){
      return { statusCode:200, headers, body: JSON.stringify({ success:false, message:'Invalid session. Please request OTP again.' }) };
    }

    let otpData;
    try{
      otpData = JSON.parse(Buffer.from(otp_token, 'base64').toString());
    }catch(e){
      return { statusCode:200, headers, body: JSON.stringify({ success:false, message:'Invalid OTP token.' }) };
    }

    // Check expiry
    if(Date.now() > otpData.expires){
      return { statusCode:200, headers, body: JSON.stringify({ success:false, message:'OTP expired. Please request a new one.' }) };
    }

    // Check mobile matches
    if(otpData.mobile !== mobile){
      return { statusCode:200, headers, body: JSON.stringify({ success:false, message:'Mobile number mismatch.' }) };
    }

    // Verify OTP
    if(otpData.otp !== otp){
      return { statusCode:200, headers, body: JSON.stringify({ success:false, message:'Wrong OTP. Please try again.' }) };
    }

    // OTP verified! Create/get user
    const userName = name || otpData.name || 'User';
    const userId = 'mob_' + mobile;

    // Save to Supabase if configured
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if(supabaseUrl && supabaseKey){
      try{
        // Upsert user in Supabase
        await fetch(supabaseUrl + '/rest/v1/users', {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            id: userId,
            name: userName,
            mobile: mobile,
            last_login: new Date().toISOString()
          })
        });
      }catch(e){ console.error('Supabase save error:', e.message); }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        message: 'Login successful',
        user: {
          id: userId,
          name: userName,
          mobile: mobile.replace('91',''),
          email: ''
        }
      })
    };

  }catch(e){
    console.error('verify-otp error:', e.message);
    return { statusCode:200, headers, body: JSON.stringify({ success:false, message: e.message }) };
  }
};
