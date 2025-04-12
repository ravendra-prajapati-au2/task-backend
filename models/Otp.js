const mongoose = require("mongoose");
const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } }, // expires in 5 mins
});

module.exports = mongoose.model("Otp", otpSchema);
