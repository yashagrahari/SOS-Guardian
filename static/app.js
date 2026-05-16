const BUFFER_SIZE = 3;

const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const micBtn = document.getElementById("mic-btn");
const micLabel = document.getElementById("mic-label");
const transcriptList = document.getElementById("transcript-list");
const agentOutput = document.getElementById("agent-output");
const emailBadge = document.getElementById("email-badge");
const statusCard = document.getElementById("status-card");
const statusTitle = document.getElementById("status-title");
const statusSubtitle = document.getElementById("status-subtitle");
const bufferBadge = document.getElementById("buffer-badge");
const appShell = document.getElementById("app");

let conversationBuffer = [];
let listening = false;
let analyzing = false;
let recognition = null;

async function ensureSession() {
  const res = await fetch("/api/me");
  if (!res.ok) {
    window.location.href = "/";
    return null;
  }
  const data = await res.json();
  userEmailEl.textContent = data.email;
  return data.email;
}

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
});

function updateBufferBadge() {
  bufferBadge.textContent = `${conversationBuffer.length} / ${BUFFER_SIZE} utterances`;
}

function addTranscript(text, interim = false) {
  const li = document.createElement("li");
  li.textContent = text;
  if (interim) li.classList.add("interim");
  transcriptList.appendChild(li);
  transcriptList.scrollTop = transcriptList.scrollHeight;
  return li;
}

function setStatus(mode, title, subtitle) {
  statusCard.classList.toggle("emergency", mode === "emergency");
  statusTitle.textContent = title;
  statusSubtitle.textContent = subtitle;
}

function showAgentResult(data) {
  agentOutput.classList.remove("empty");
  agentOutput.classList.toggle("emergency", data.email_sent);
  agentOutput.textContent = data.output;

  if (data.email_sent) {
    emailBadge.hidden = false;
    emailBadge.className = "badge badge-sent";
    emailBadge.textContent = `SOS email sent to ${data.recipient}`;
    setStatus("emergency", "Emergency detected", "SOS alert dispatched to your inbox");
  } else {
    emailBadge.hidden = true;
    setStatus("safe", "Monitoring", "No emergency — continuing to listen");
  }
}

async function analyzeBuffer() {
  if (analyzing || conversationBuffer.length < BUFFER_SIZE) return;

  analyzing = true;
  appShell.classList.add("analyzing");
  setStatus("safe", "Analyzing…", "Agent is reviewing recent speech");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...conversationBuffer] }),
    });
    if (!res.ok) throw new Error("Analysis failed");
    const data = await res.json();
    showAgentResult(data);
  } catch (err) {
    agentOutput.textContent = `Error: ${err.message}`;
    setStatus("safe", "Error", "Could not reach the agent — try again");
  } finally {
    analyzing = false;
    appShell.classList.remove("analyzing");
    conversationBuffer = [];
    updateBufferBadge();
  }
}

function pushUtterance(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  addTranscript(trimmed);
  conversationBuffer.push(trimmed);
  if (conversationBuffer.length > BUFFER_SIZE) {
    conversationBuffer = conversationBuffer.slice(-BUFFER_SIZE);
  }
  updateBufferBadge();

  if (conversationBuffer.length === BUFFER_SIZE) {
    analyzeBuffer();
  }
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micLabel.textContent = "Speech API unavailable — use demo phrases below";
    micBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let interimEl = null;

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }

    if (interim) {
      if (!interimEl) interimEl = addTranscript(interim, true);
      interimEl.textContent = interim;
    }

    if (finalText) {
      if (interimEl) {
        interimEl.remove();
        interimEl = null;
      }
      pushUtterance(finalText);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech") return;
    micLabel.textContent = `Mic error: ${event.error}`;
    stopListening();
  };

  recognition.onend = () => {
    if (listening) recognition.start();
  };
}

function startListening() {
  if (!recognition) return;
  listening = true;
  micBtn.classList.add("listening");
  micLabel.textContent = "Listening… click to stop";
  recognition.start();
}

function stopListening() {
  listening = false;
  micBtn.classList.remove("listening");
  micLabel.textContent = "Click to start listening";
  if (recognition) recognition.stop();
}

micBtn.addEventListener("click", () => {
  if (listening) stopListening();
  else startListening();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const lines = (chip.dataset.demo || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    for (const line of lines) pushUtterance(line);
  });
});

setupSpeechRecognition();
ensureSession();
updateBufferBadge();
