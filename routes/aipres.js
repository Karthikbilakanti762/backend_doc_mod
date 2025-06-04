
/*
const express = require("express");
const axios = require("axios");

const router = express.Router();
require("dotenv").config();

// POST route to handle speech-to-text input
router.post("/", async (req, res) => {
  const { text } = req.body;

  // ChatGPT prompt for parsing the prescription
  const systemPrompt = `
    You are a medical assistant. Convert the following spoken prescription into an array of medicine objects with this format:

    [
      {
        "name": "Medicine name",
        "dosage": "Dosage",
        "duration": "How long to take",
        "instructions": "How/when to take"
      }
    ]
  
    Spoken Prescription:
    "${text}"
  `;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const { choices } = response.data;

    if (!choices || !choices[0]) {
      throw new Error("Invalid GPT response");
    }

    const content = choices[0].message.content;
    
    // Try parsing the content into JSON
    const medications = JSON.parse(content);

    return res.status(200).json({ medications });
  } catch (err) {
    console.error("Error parsing prescription:", err);
    return res.status(500).json({
      error: "Failed to process prescription. Please try again.",
    });
  }
});

module.exports = router;
*/

// aipres.js - Improved version with rate limiting handling

const axios = require('axios');
require('dotenv').config();

// Utility for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue to manage API requests
class RequestQueue {
  constructor(maxConcurrent = 1, requestsPerMinute = 10) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
    this.minTimeBetweenRequests = 60000 / requestsPerMinute;
    this.lastRequestTime = 0;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    this.running++;
    const { fn, resolve, reject } = this.queue.shift();

    const now = Date.now();
    const timeToWait = Math.max(0, this.minTimeBetweenRequests - (now - this.lastRequestTime));
    if (timeToWait > 0) {
      await sleep(timeToWait);
    }

    try {
      this.lastRequestTime = Date.now();
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

const apiQueue = new RequestQueue(1, 10);

// API callers
async function callOpenAI(data, retries = 3, backoff = 2000) {
  const makeRequest = async (attempt = 0) => {
    try {
      return await axios.post('https://api.openai.com/v1/chat/completions', data, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    } catch (error) {
      const code = error.response?.status || error.code;
      console.log(`OpenAI API call error: ${code}`);
      if ((code === 429 || code === 'ECONNRESET') && attempt < retries) {
        const waitTime = backoff * Math.pow(2, attempt);
        console.log(`Retrying OpenAI in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(waitTime);
        return makeRequest(attempt + 1);
      }
      throw error;
    }
  };
  return await makeRequest();
}

async function callGroq(data, retries = 3, backoff = 2000) {
  const makeRequest = async (attempt = 0) => {
    try {
      return await axios.post('https://api.groq.com/openai/v1/chat/completions', data, {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    } catch (error) {
      const code = error.response?.status || error.code;
      console.log(`Groq API call error: ${code}`);
      if ((code === 429 || code === 'ECONNRESET') && attempt < retries) {
        const waitTime = backoff * Math.pow(2, attempt);
        console.log(`Retrying Groq in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(waitTime);
        return makeRequest(attempt + 1);
      }
      throw error;
    }
  };
  return await makeRequest();
}

// Core AI logic
async function parsePrescription(prescriptionText) {
  const model = process.env.USE_GROQ === 'true' ? 'llama3-8b-8192' : 'gpt-3.5-turbo-0125';

  const data = {
    model,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `
You are a helpful medical assistant. Convert the following spoken prescription into a JSON array of medicine objects in the following format ONLY:

[
  {
    "name": "Medicine name",
    "dosage": "Dosage",
    "duration": "How long to take",
    "instructions": "How/when to take"
  }
]

Do NOT return any extra text. Only valid parsable JSON.`
      },
      {
        role: "user",
        content: `Prescription: "${prescriptionText}"`
      }
    ]
  };

  try {
    const primaryResponse = await apiQueue.add(() =>
      process.env.USE_GROQ === 'true' ? callGroq(data) : callOpenAI(data)
    );
    return primaryResponse;
  } catch (err) {
    console.warn("Primary model failed. Falling back...");
    try {
      return await apiQueue.add(() => callOpenAI(data));
    } catch (fallbackError) {
      console.error("Both Groq and OpenAI failed.");
      throw fallbackError;
    }
  }
}

// Route handler
async function handlePrescriptionRoute(req, res) {
  try {
    const { prescription, text } = req.body;
    const prescriptionText = prescription || text;

    if (!prescriptionText) {
      return res.status(400).json({
        success: false,
        error: "Prescription text is required",
        data: []
      });
    }

    const response = await parsePrescription(prescriptionText);
    const rawContent = response.data?.choices?.[0]?.message?.content || "";

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawContent);

      if (!Array.isArray(parsedResult)) {
        throw new Error("Expected an array of medications");
      }

      parsedResult = parsedResult.map(med => ({
        name: med.name || "",
        dosage: med.dosage || "",
        duration: med.duration || "",
        instructions: med.instructions || ""
      }));
    } catch (parseError) {
      console.error("❌ Error parsing AI response:", parseError);
      console.error("🧾 Raw AI response content:", rawContent);
      return res.status(500).json({
        success: false,
        error: "Failed to parse AI response",
        data: []
      });
    }

    return res.json({
      success: true,
      data: parsedResult
    });
  } catch (error) {
    console.error("❌ Error parsing prescription:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to parse prescription",
      message: error.message,
      data: []
    });
  }
}

module.exports = {
  handlePrescriptionRoute,
  parsePrescription
};
