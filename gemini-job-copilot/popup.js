const DEFAULT_PROFILE = `Name: Medida Janardhana Sri Naga Sai Ganesh
Email: ganeshmedida4066@gmail.com
Phone: +91-XXXXXXXXXX
Location: Madhapur, Hyderabad, Telangana, India
LinkedIn: https://linkedin.com/in/ganesh-medida
GitHub: https://github.com/GaneshMba4066
Website: https://trustandthread.com
Total Experience: 5+ Years in Embedded Systems & Firmware Engineering

Current Role: Technical Lead (Embedded & Testing Unit) at HCLTech, Hyderabad (Aug 2023 – Present)
- Lead low-level design, development, and integration of bare-metal firmware, RTOS-based applications, networking drivers, and hardware interfaces on ARM Cortex-M microcontrollers using C and C++.
- Modernize legacy architecture and embedded test infrastructure by architecting automated validation tooling frameworks in C and Python.
- Drive hardware-software integration pipelines focusing on reliable firmware execution and system stability.

Previous Role: Embedded Hardware & Software Engineer at BPM Microsystems (4 Years)
- Built custom Linux kernel drivers and user-space HALs to bridge high-speed interfaces with target hardware controllers.
- Led board bring-up and BSP development across SoC families, validating signal integrity using oscilloscopes and logic analyzers.
- Designed deterministic low-level communication stacks over SPI, I2C, and UART for production device programming and high-speed flashing.

Internship: Engineering Intern at DRDL - DRDO (Dec 2019 – Jan 2020)
- Telemetry acquisition and embedded signal processing.

Education & Credentials:
- Master of Business Administration (MBA)
- B.Tech in Electronics & Communication Engineering, Godavari Institute of Engineering and Technology (2023)
- AWS Certified Cloud Practitioner
- Smart India Hackathon (SIH) Winner - Hardware Edition

Core Technical Skills:
- Languages: Embedded C (C99/C11), C++, Rust, Python, Bash, ARM Assembly
- Microcontrollers & SoCs: ARM Cortex-M (STM32, NXP, TI), ESP32, SoC BSP Bring-up
- RTOS & Kernel: FreeRTOS, Embedded Linux (Yocto, Device Trees, Kernel Modules)
- Protocols & Buses: SPI, I2C, UART, CAN/CAN-FD, Ethernet, TCP/IP, USB
- Hardware Tools: Oscilloscopes, Logic Analyzers, JTAG/SWD Debuggers, GDB, Multimeters
- Version Control & CI/CD: Git, GitHub, GitLab CI, Automated Hardware-in-the-Loop (HIL) Testing`;

// UI Elements
const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const modelSelect = document.getElementById("modelSelect");
const profileInput = document.getElementById("profile");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsStatus = document.getElementById("settingsStatus");

const fillBtn = document.getElementById("fillBtn");
const autofillStatus = document.getElementById("autofillStatus");
const statsGrid = document.getElementById("statsGrid");
const statDetected = document.getElementById("statDetected");
const statFilled = document.getElementById("statFilled");
const statSkipped = document.getElementById("statSkipped");

const genCoverBtn = document.getElementById("genCoverBtn");
const coverLetterTone = document.getElementById("coverLetterTone");
const coverLetterOutput = document.getElementById("coverLetterOutput");
const copyCoverBtn = document.getElementById("copyCoverBtn");
const coverStatus = document.getElementById("coverStatus");

// Tab Navigation
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// Toggle API Key visibility
toggleKeyBtn.addEventListener("click", () => {
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleKeyBtn.textContent = "🙈";
  } else {
    apiKeyInput.type = "password";
    toggleKeyBtn.textContent = "👁️";
  }
});

// Load Settings
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["geminiApiKey", "geminiModel", "candidateProfile"], (data) => {
    if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
    if (data.geminiModel) modelSelect.value = data.geminiModel;
    profileInput.value = data.candidateProfile || DEFAULT_PROFILE;
  });
});

// Save Settings
saveSettingsBtn.addEventListener("click", () => {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const profile = profileInput.value.trim();

  chrome.storage.local.set({
    geminiApiKey: apiKey,
    geminiModel: model,
    candidateProfile: profile
  }, () => {
    settingsStatus.textContent = "Settings saved successfully!";
    settingsStatus.className = "status-box success";
    setTimeout(() => {
      settingsStatus.textContent = "Saved locally in your browser storage.";
      settingsStatus.className = "status-box";
    }, 3000);
  });
});

// Call Gemini API with automatic fallback
async function callGemini(apiKey, model, prompt, expectJson = true) {
  const modelsToTry = [model, "gemini-2.0-flash", "gemini-1.5-flash"].filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {}
      };

      if (expectJson) {
        bodyPayload.generationConfig = {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "INTEGER", description: "The fieldIndex from the form scan" },
                value: { type: "STRING", description: "The string value, selected option, or boolean answer" },
                reasoning: { type: "STRING", description: "Brief justification for the mapping" }
              },
              required: ["id", "value"]
            }
          }
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        }
      );

      const resJson = await response.json();
      if (resJson.error) {
        throw new Error(`[${m}] ${resJson.error.message}`);
      }

      const content = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error(`Empty response returned by model ${m}`);
      }

      return content;
    } catch (err) {
      console.warn(`Model ${m} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to contact Gemini API.");
}

// Autofill Form Click Handler
fillBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const profile = profileInput.value.trim() || DEFAULT_PROFILE;
  const model = modelSelect.value || "gemini-2.0-flash";

  if (!apiKey) {
    autofillStatus.textContent = "Error: Please enter your Gemini API Key in the Settings tab.";
    autofillStatus.className = "status-box error";
    return;
  }

  autofillStatus.textContent = "Inspecting DOM for inputs, selects, and radio groups...";
  autofillStatus.className = "status-box";
  statsGrid.style.display = "none";
  fillBtn.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Could not access active browser tab.");

    // Inject and execute content script scanner
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const pageData = injectionResults[0]?.result;
    if (!pageData || !pageData.fields || pageData.fields.length === 0) {
      autofillStatus.textContent = "No fillable form fields detected. Ensure you are on an active job application form.";
      autofillStatus.className = "status-box";
      fillBtn.disabled = false;
      return;
    }

    statDetected.textContent = pageData.fields.length;
    statsGrid.style.display = "grid";
    autofillStatus.textContent = `Found ${pageData.fields.length} candidate fields. Querying ${model} with schema enforcement...`;

    const prompt = `You are an elite, truthful assistive job application co-pilot.
Your goal is to map the candidate's authentic profile to the web form fields extracted from this page.

GROUND-TRUTH CANDIDATE PROFILE:
${profile}

JOB APPLICATION PAGE CONTEXT:
${pageData.pageText}

DETECTED FORM FIELDS:
${JSON.stringify(pageData.fields)}

CRITICAL MAPPING & COMPLIANCE RULES:
1. Strict Honesty: Never hallucinate employers, degrees, or certifications. Stick solely to the candidate profile.
2. Screening Questions: If asked qualitative questions (e.g. "Describe your experience with ARM Cortex-M/RTOS", "Why are you interested in this role?"), craft a sharp, impactful, first-person answer highlighting relevant achievements from HCLTech or BPM Microsystems.
3. Radio & Select Options: For select dropdowns or radio groups, choose the closest matching option text from the provided 'options' list. If no exact match, pick the most semantically accurate option.
4. Unknown / Sensitive Compensation / Notice Period: If a field asks for current CTC, expected CTC, desired salary, or notice period days and it is NOT explicitly specified in the profile, return "" (empty string) so the candidate can fill it manually with their exact figures.
5. Work Authorization: Candidate is an Indian citizen located in Hyderabad, India. For questions like "Are you authorized to work in India?", select Yes/True. For questions requiring US/UK sponsorship or work clearance, answer truthfully based on location (requires sponsorship if applying outside India).
6. Return format: Output a valid JSON array of objects with { id: number, value: string, reasoning: string }.`;

    const rawJson = await callGemini(apiKey, model, prompt, true);
    let mappings = [];
    try {
      mappings = JSON.parse(rawJson);
    } catch (e) {
      // Strip any backticks if present
      const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
      mappings = JSON.parse(cleaned);
    }

    autofillStatus.textContent = `Injecting ${mappings.length} parsed answers into DOM...`;

    // Inject values back into the DOM using content script function
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (filledData) => {
        if (typeof window.applyGeminiAutofill === "function") {
          return window.applyGeminiAutofill(filledData);
        }
        return { filled: 0, skipped: 0 };
      },
      args: [mappings]
    });

    const populatedCount = mappings.filter(m => m.value && m.value.trim().length > 0).length;
    statFilled.textContent = populatedCount;
    statSkipped.textContent = pageData.fields.length - populatedCount;

    autofillStatus.textContent = `Success! Autofilled ${populatedCount} fields with framework-level events dispatched. Green outlines show populated fields. Review before submitting!`;
    autofillStatus.className = "status-box success";
  } catch (err) {
    console.error("Autofill error:", err);
    autofillStatus.textContent = `Error: ${err.message}`;
    autofillStatus.className = "status-box error";
  } finally {
    fillBtn.disabled = false;
  }
});

// Generate Tailored Cover Letter Handler
genCoverBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  const profile = profileInput.value.trim() || DEFAULT_PROFILE;
  const model = modelSelect.value || "gemini-2.0-flash";
  const tone = coverLetterTone.value;

  if (!apiKey) {
    coverStatus.textContent = "Error: Please enter your Gemini API Key in Settings.";
    coverStatus.className = "status-box error";
    return;
  }

  coverStatus.textContent = "Extracting job details from page and drafting letter...";
  coverStatus.className = "status-box";
  genCoverBtn.disabled = true;
  coverLetterOutput.style.display = "none";
  copyCoverBtn.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.substring(0, 4000)
    });

    const pageText = injectionResults[0]?.result || "Job Application";

    const prompt = `You are a career strategist crafting an authentic, high-impact cover letter.
CANDIDATE BACKGROUND:
${profile}

JOB DESCRIPTION CONTEXT:
${pageText}

TONE FOCUS: ${tone}

REQUIREMENTS:
- Maximum 3 concise, punchy paragraphs (250-320 words).
- Hook: Open with candidate's specific background as Technical Lead at HCLTech and previous 4 years at BPM Microsystems, connecting directly to the hiring team's embedded systems/firmware needs.
- Body: Detail 2 high-impact technical feats (e.g. bare-metal ARM Cortex-M firmware, RTOS, custom Linux kernel drivers/HALs, high-speed SPI/UART/CAN test tooling).
- Closing: Professional, forward-looking call to discuss technical alignment.
- Output ONLY the body of the letter. Do not include placeholder brackets like [Hiring Manager Name] if you can use "Hiring Team".`;

    const letter = await callGemini(apiKey, model, prompt, false);
    coverLetterOutput.textContent = letter.trim();
    coverLetterOutput.style.display = "block";
    copyCoverBtn.style.display = "block";
    coverStatus.textContent = "Tailored cover letter generated successfully!";
    coverStatus.className = "status-box success";
  } catch (err) {
    coverStatus.textContent = `Error: ${err.message}`;
    coverStatus.className = "status-box error";
  } finally {
    genCoverBtn.disabled = false;
  }
});

// Copy Cover Letter
copyCoverBtn.addEventListener("click", () => {
  const text = coverLetterOutput.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyCoverBtn.textContent = "✅ Copied to Clipboard!";
    setTimeout(() => {
      copyCoverBtn.textContent = "📋 Copy to Clipboard";
    }, 2500);
  });
});
