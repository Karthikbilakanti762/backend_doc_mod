// routes/ai.js
const express = require("express");
const fetch = require('node-fetch');
const router = express.Router();

// Utility function to clean and parse AI response
const parseAIResponse = (aiResponse, medicineNames) => {
  try {
    // More comprehensive cleaning
    let cleanedResponse = aiResponse
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/^\s*json\s*/gi, '')
      .trim();
    
    // Remove any leading/trailing non-JSON content
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd);
    }
    
    const parsed = JSON.parse(cleanedResponse);
    
    // Validate that it's an object with string values
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Response is not an object');
    }
    
    return parsed;
  } catch (error) {
    console.error('JSON parsing failed:', error);
    console.error('Original response:', aiResponse);
    
    // Try to extract information using regex as fallback
    const fallbackDescriptions = {};
    medicineNames.forEach(name => {
      // Try to find medicine name followed by description in the text
      const regex = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`, 'i');
      const match = aiResponse.match(regex);
      if (match && match[1]) {
        fallbackDescriptions[name] = match[1];
      } else {
        fallbackDescriptions[name] = "Description not available - please consult your healthcare provider.";
      }
    });
    
    return fallbackDescriptions;
  }
};

// Batch medicine descriptions
router.post('/batch', async (req, res) => {
  const { medicineNames } = req.body;

  if (!medicineNames || !Array.isArray(medicineNames) || medicineNames.length === 0) {
    return res.status(400).json({ error: 'medicineNames array is required' });
  }

  // Validate medicine names
  const validMedicineNames = medicineNames
    .filter(name => name && typeof name === 'string' && name.trim().length > 0)
    .map(name => name.trim());

  if (validMedicineNames.length === 0) {
    return res.status(400).json({ error: 'No valid medicine names provided' });
  }

  try {
    console.log('Processing batch descriptions for:', validMedicineNames);

    // Check if API key exists
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    // Create structured prompt
    const medicineList = validMedicineNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
    
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a medical information assistant. You must respond with ONLY valid JSON. No explanations, no markdown, no additional text.
            
Example format:
{
  "Medicine A": "Brief description here",
  "Medicine B": "Brief description here"
}`,
          },
          {
            role: 'user',
            content: `Provide patient-friendly descriptions for these medicines. Respond with ONLY valid JSON:

${medicineList}

Format: {"${validMedicineNames[0]}": "description", "${validMedicineNames[1]}": "description", ...}

Remember: ONLY JSON, no other text.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3, // Lower temperature for more consistent formatting
      }),
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      throw new Error(`Groq API error: ${groqRes.status} - ${errorText}`);
    }

    const data = await groqRes.json();
    const aiResponse = data?.choices?.[0]?.message?.content?.trim();

    if (!aiResponse) {
      throw new Error('Empty response from AI');
    }

    console.log('Raw AI response:', aiResponse);

    // Parse the response with fallback
    let descriptions = parseAIResponse(aiResponse, validMedicineNames);

    // Ensure all requested medicines have descriptions
    validMedicineNames.forEach(name => {
      if (!descriptions[name] || typeof descriptions[name] !== 'string') {
        descriptions[name] = "Description not available - please consult your healthcare provider.";
      }
    });

    console.log('Final descriptions object:', descriptions);

    res.json({ 
      descriptions,
      success: true,
      processedCount: validMedicineNames.length
    });

  } catch (err) {
    console.error('Error in batch description generation:', err);
    
    // Always provide fallback response
    const fallbackDescriptions = {};
    validMedicineNames.forEach(name => {
      fallbackDescriptions[name] = "Description temporarily unavailable - please consult your healthcare provider.";
    });

    // Return 200 with fallback instead of error to keep UI working
    res.json({ 
      descriptions: fallbackDescriptions,
      success: false,
      error: err.message,
      fallback: true
    });
  }
});

// Single medicine description (improved)
router.post('/', async (req, res) => {
  const { medicineName } = req.body;

  if (!medicineName || typeof medicineName !== 'string') {
    return res.status(400).json({ error: 'Valid medicine name required' });
  }

  try {
    // Use the batch endpoint for consistency
    const batchResponse = await fetch(`${req.protocol}://${req.get('host')}/api/ai/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicineNames: [medicineName.trim()] })
    });

    const batchData = await batchResponse.json();
    const description = batchData.descriptions?.[medicineName.trim()] || "No description available.";

    res.json({ description });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

module.exports = router;