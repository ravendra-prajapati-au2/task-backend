const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await Otp.deleteMany({ email });
  await new Otp({ email, otp }).save();

  await sendEmail(email, "OTP Verification", `Your OTP is ${otp}`);

  res.json({ message: "OTP sent" });
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const otpDoc = await Otp.findOne({ email, otp });
  if (!otpDoc)
    return res.status(400).json({ message: "Invalid or expired OTP" });

  await Otp.deleteMany({ email });
  res.json({ message: "Email verified" });
};

exports.signup = async (req, res) => {
  const { firstName, lastName, email, mobile, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser)
    return res.status(400).json({ message: "Email already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    userId: uuidv4(),
    firstName,
    lastName,
    email,
    mobile,
    password: hashedPassword,
    isVerified: true,
  });

  await user.save();
  res.json({ message: "User registered successfully" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const now = new Date();
  if (
    user.loginAttempts >= 3 &&
    user.lastLoginAttempt &&
    now - user.lastLoginAttempt < 3 * 60 * 60 * 1000
  ) {
    return res
      .status(429)
      .json({ message: "Too many attempts. Please try again after 3 hours." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    user.loginAttempts += 1;
    user.lastLoginAttempt = now;
    await user.save();
    return res.status(401).json({ message: "Invalid credentials" });
  }

  user.loginAttempts = 0;
  user.lastLoginAttempt = null;
  await user.save();

  const token = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET);
  res.json({ token });
};

exports.getProfile = async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId }).select(
    "-password"
  );
  res.json(user);
};

exports.updatePassword = async (req, res) => {
  const { newPassword } = req.body;
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await User.updateOne(
    { userId: req.user.userId },
    { password: hashedPassword }
  );
  res.json({ message: "Password updated" });
};
