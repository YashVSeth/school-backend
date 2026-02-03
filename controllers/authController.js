const User = require('../models/User'); 
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const { MailtrapClient } = require("mailtrap");

// --- EMAIL TEMPLATE ---
const emailTemplate = (resetLink, userName) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px; }
    .header { background-color: #c32029; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { padding: 20px; line-height: 1.6; color: #333; }
    .button { display: inline-block; padding: 12px 25px; background-color: #c32029; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { font-size: 12px; color: #777; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Radhey Shyam School</h1>
    </div>
    <div class="content">
      <h2>Hello ${userName || 'User'},</h2>
      <p>We received a request to reset your password. Click the button below to proceed:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      <p><strong>Note:</strong> This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Radhey Shyam Shikshan Sansthaan © 2026</p>
    </div>
  </div>
</body>
</html>
`;

// --- 1. REGISTER USER ---
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// --- 2. LOGIN USER ---
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// --- 3. FORGOT PASSWORD ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `http://localhost:5173/reset-password/${token}`;

    const client = new MailtrapClient({ token: process.env.MAILTRAP_TOKEN });

    const sender = {
      email: "hello@demomailtrap.co",
      name: "School Management System",
    };

    const recipients = [{ email }];

    await client.send({
      from: sender,
      to: recipients,
      subject: "Password Reset Request",
      html: emailTemplate(resetLink, user.name), // Now defined above!
      category: "Password Reset",
    });

    res.json({ message: "Reset link sent successfully via API!" });

  } catch (error) {
    console.error("Mailtrap API Error:", error);
    res.status(500).json({ message: "Error sending email", error: error.message });
  }
};

// --- 4. RESET PASSWORD ---
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Invalid or expired token" });
  }
};