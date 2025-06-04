const express = require("express");
const router = express.Router();
const twilio = require("twilio");

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN; // ✅ from env
const client = twilio(accountSid, authToken);

router.post("/", async (req, res) => {
  const { number, message } = req.body;

  try {
    await client.messages.create({
      from: "whatsapp:+14155238886" , // Twilio sandbox number
      to: `whatsapp:${number}`,
      body: message,
    });

    res.status(200).json({ success: true, msg: "Message sent successfully." });
  } catch (err) {
    console.error("Error sending WhatsApp:", err);
    res.status(500).json({ success: false, error: "Failed to send message." });
  }
});

module.exports = router;
