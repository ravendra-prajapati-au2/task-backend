const express = require("express");
const User = require("../models/User");
const Otp = require("../models/Otp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOtp } = require("../services/otpService");

const router = express.Router();

// Signup Route
router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, mobileNumber, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "Email already registered" });

    const user = new User({
      firstName,
      lastName,
      email,
      mobileNumber,
      password,
    });
    await user.save();

    const { otp, expiry } = await sendOtp(email);
    const otpRecord = new Otp({ email, otp, expiry });
    await otpRecord.save();

    res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// OTP Verification Route
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });

    const isOtpValid = otpRecord.otp === otp && new Date() < otpRecord.expiry;
    if (!isOtpValid)
      return res.status(400).json({ message: "OTP expired or incorrect" });

    await User.updateOne({ email }, { emailVerified: true });
    await Otp.deleteOne({ email }); // OTP consumed

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.emailVerified)
      return res.status(400).json({ message: "Email not verified" });

    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ message: "Access denied" });

  const token = authHeader.split(" ")[1]; // Extract token after "Bearer"
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    const message =
      error.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    res.status(401).json({ message });
  }
}

// Fetch User Profile
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update User Password
router.put("/update-password", verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.userId);
    const match = await user.matchPassword(oldPassword);
    if (!match)
      return res.status(400).json({ message: "Incorrect old password" });

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
