const emailTemplate = (resetLink, userName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .header { background-color: #c32029; padding: 30px; text-align: center; color: #ffffff; }
    .content { padding: 40px; line-height: 1.6; color: #333333; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { background-color: #c32029; color: #ffffff !important; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block; }
    .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #777777; border-top: 1px solid #eeeeee; }
    .warning { font-size: 13px; color: #999999; margin-top: 20px; border-top: 1px dashed #cccccc; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Radhey Shyam Shakuntala Seth Shikshan Sansthaan</h1>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello ${userName || 'User'},</p>
      <p>We received a request to reset the password for your account. If you didn't make this request, you can safely ignore this email.</p>
      
      <div class="button-container">
        <a href="${resetLink}" class="button">Reset My Password</a>
      </div>

      <p>This link is valid for <strong>15 minutes</strong> only.</p>
      
      <div class="warning">
        <p>If the button above doesn't work, copy and paste the following link into your browser:</p>
        <p style="word-break: break-all; color: #c32029;">${resetLink}</p>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2024 Radhey Shyam Shakuntala Seth Shikshan Sansthaan. All rights reserved.</p>
      <p>Maharaj Nagar, Uttar Pradesh, India</p>
    </div>
  </div>
</body>
</html>
`;