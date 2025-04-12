const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const User = require("./models/User");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

app.use("/api", authRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    app.listen(5000, () => console.log("Server running on port 5000"))
  )
  .catch((err) => console.log(err));

cron.schedule("0 */3 * * *", async () => {
  await User.updateMany({}, { loginAttempts: 0, lastLoginAttempt: null });
});
