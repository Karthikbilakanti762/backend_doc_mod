const express = require("express");
const router = express.Router();
const axios = require("axios");
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama3-8b-8192";

// Helper function to clean and parse JSON from AI response
function parseAIResponse(content) {
  try {
    // Remove markdown code blocks if present
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanContent);
  } catch (error) {
    // If JSON parsing fails, try to extract structured data manually
    console.log("Failed to parse JSON, attempting manual extraction...");
    
    const advice = content.match(/(?:advice|general)[^:]*:\s*["']([^"']+)["']/i)?.[1] || 
                  content.match(/advice[^:]*:\s*([^,\n}]+)/i)?.[1]?.trim() || "";
    
    const dosMatch = content.match(/do'?s[^:]*:\s*\[([^\]]+)\]/i) || 
                    content.match(/do'?s[^:]*:\s*([^,\n}]+)/i);
    const dos = dosMatch ? dosMatch[1].split(',').map(item => item.replace(/['"]/g, '').trim()) : [];
    
    const dontsMatch = content.match(/don'?ts?[^:]*:\s*\[([^\]]+)\]/i) || 
                      content.match(/don'?ts?[^:]*:\s*([^,\n}]+)/i);
    const donts = dontsMatch ? dontsMatch[1].split(',').map(item => item.replace(/['"]/g, '').trim()) : [];
    
    return { advice, dos, donts };
  }
}

router.post("/", async (req, res) => {
  const { diagnosis } = req.body;

  console.log("Received diagnosis:", diagnosis);
  console.log("GROQ_API_KEY present:", !!GROQ_API_KEY);

  if (!diagnosis) {
    return res.status(400).json({ error: "Diagnosis is required" });
  }

  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set");
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const prompt = `As a gynecologist, provide professional and evidence-based medical advice for the gynecological condition "${diagnosis}" in the exact JSON format below. Your advice should be clear, medically accurate, and suitable for patient guidance.

{
  "advice": "Brief overview and general advice for managing this condition",
  "dos": ["Recommended action 1", "Recommended action 2", "Recommended action 3"],
  "donts": ["Avoid this 1", "Avoid this 2", "Avoid this 3"]
}
Only respond with valid JSON. Do not include any explanations, greetings, or additional text.`;

    console.log("Sending request to Groq API...");

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent JSON
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log("Groq API response status:", groqResponse.status);
    
    const message = groqResponse.data.choices[0].message.content;
    console.log("Raw AI response:", message);

    const responseJSON = parseAIResponse(message);
    console.log("Parsed response:", responseJSON);

    // Ensure we have valid data
    const advice = responseJSON.advice || "Please consult with your healthcare provider for specific advice regarding this condition.";
    const dos = Array.isArray(responseJSON.dos) ? responseJSON.dos : ["Follow your doctor's recommendations", "Take prescribed medications as directed"];
    const donts = Array.isArray(responseJSON.donts) ? responseJSON.donts : ["Don't ignore symptoms", "Don't self-medicate without consulting a doctor"];

    res.json({
      advice: advice,
      dos: dos.join("\n"), // Use single backslash for newlines
      donts: donts.join("\n"),
    });

  } catch (error) {
    console.error("Detailed error information:");
    console.error("Error message:", error.message);
    
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    }
    
    // Provide fallback response
    res.status(500).json({ 
      error: "Failed to generate AI advice",
      fallback: true,
      advice: "Please consult with your healthcare provider for specific advice regarding this condition.",
      dos: "Follow your doctor's recommendations\nTake prescribed medications as directed\nMaintain regular follow-ups",
      donts: "Don't ignore persistent symptoms\nDon't self-medicate without consulting a doctor\nDon't delay seeking medical attention if symptoms worsen"
    });
  }
});

module.exports = router;