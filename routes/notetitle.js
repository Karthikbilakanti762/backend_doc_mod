// routes/notetitle.js
const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.post("/generate-title", async (req, res) => {
  const { content } = req.body;

  if (!content || content.length < 20) {
    return res.status(400).json({ message: "Insufficient content to generate title" });
  }

  try {
    const prompt = `Generate a concise medical note title for the following clinical note , only give the title content:\n\n"${content}"\n\nTitle:`;

    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: "You are a helpful medical assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 20,
      temperature: 0.5,
    });

    const title = response.choices[0].message.content.trim();
    res.status(200).json({ title });
  } catch (error) {
    console.error("Groq error:", error.message);
    res.status(500).json({ message: "AI title generation failed" });
  }
});

module.exports = router;
