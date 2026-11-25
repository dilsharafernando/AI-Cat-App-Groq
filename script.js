// ==========================================
// 🔑 PASTE YOUR API KEYS HERE
// ==========================================
const CONFIG = {
  GROQ_API_KEY: "Replace_with_your_Groq_API_key",
  GEMINI_API_KEY: "Replace_with_your_Gemini_API_key"
};
// ==========================================

const chatForm = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');
const catFace = document.getElementById('catFace');

const catPrompt = "You are a cute, playful AI cat. Reply like a cat using 'meow' and 'purr', while still giving helpful answers.";

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

// Pick a valid Llama / Qwen text chat model from Groq
async function getActiveGroqModel() {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq Models Error');

  const preferred = data.data.find((m) => m.id === 'llama-3.1-8b-instant');
  if (preferred) return preferred.id;

  const fallback = data.data.find(
    (m) => (m.id.includes('llama') || m.id.includes('qwen') || m.id.includes('gemma')) &&
           !m.id.includes('guard') && !m.id.includes('vision')
  );
  return fallback ? fallback.id : 'llama-3.1-8b-instant';
}

// Call Groq API
async function askGroq(userText) {
  const activeModel = await getActiveGroqModel();

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: activeModel,
      messages: [
        { role: 'system', content: catPrompt },
        { role: 'user', content: userText }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq API Error');
  return data.choices[0].message.content;
}

// Auto-fetch available Gemini flash/pro models for your key
async function getActiveGeminiModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${CONFIG.GEMINI_API_KEY}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini ListModels Error');

  const models = data.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((id) => id.includes('gemini') && !id.includes('embedding') && !id.includes('tts') && !id.includes('image'));

  // Put flash models first for speed
  models.sort((a, b) => (a.includes('flash') ? -1 : 1));
  return models.length ? models : ['gemini-3.8-flash', 'gemini-3.8-flash-lite'];
}

// Call Gemini API (auto-switches across all available models if one is busy)
async function askGemini(userText) {
  const availableModels = await getActiveGeminiModels();
  let lastError = 'Gemini API Error';

  for (const modelName of availableModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: catPrompt }] },
        contents: [{ parts: [{ text: userText }] }]
      })
    });

    const data = await res.json();
    if (res.ok) {
      return data.candidates[0].content.parts[0].text;
    }

    lastError = data.error?.message || lastError;
  }

  throw new Error(lastError);
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const provider = document.getElementById('provider').value;
  const userInput = document.getElementById('userInput');
  const text = userInput.value.trim();

  addMessage(text, 'user');
  userInput.value = '';
  catFace.textContent = '🤔';
  const botMsg = addMessage('Thinking...', 'bot');

  try {
    let reply = '';
    if (provider === 'groq') {
      reply = await askGroq(text);
    } else {
      reply = await askGemini(text);
    }
    botMsg.textContent = reply;
    catFace.textContent = '😻';
  } catch (err) {
    botMsg.textContent = 'Error: ' + err.message;
    catFace.textContent = '😿';
  }
});