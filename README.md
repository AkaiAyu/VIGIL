# VIGIL

## AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks

VIGIL is an AI-powered voice security system designed to detect AI-generated, cloned, synthetic, and spoofed voices and identify potential voice-based social-engineering and impersonation attacks.

VIGIL combines voice anti-spoofing detection with real-time speech transcription and conversation-level threat analysis.

### Core capabilities

- 🎤 Live microphone voice detection
- 📁 Audio file analysis
- 📞 Browser-based WebRTC VoIP monitoring
- 🛡️ CallShield real-time scam and social-engineering analysis
- 📝 Real-time Deepgram speech transcription
- 🤖 Gemini / Groq conversation analysis
- 📊 Detection history and analytics
- ⚙️ Local application preferences
- 🔐 Local/demo authentication
- 🩺 Backend health monitoring

---

# 🎯 Problem Statement

**AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks**

VIGIL is designed to help identify voice-cloning and impersonation attacks that can be used for:

- Financial fraud
- Social engineering
- Bank impersonation
- Identity impersonation
- Fake customer-support calls
- AI-generated voice scams
- Other voice-based cyber attacks

Modern voice-cloning systems can generate highly realistic speech. VIGIL therefore uses two complementary security layers.

### Layer 1 — Voice Authenticity Detection

The DF-Arena 1B anti-spoofing model analyzes speech and estimates whether the voice is genuine or AI-generated/spoofed.

### Layer 2 — Conversation Threat Detection

CallShield analyzes the conversation transcript for combinations of social-engineering and scam indicators, including impersonation, requests for sensitive information, suspicious financial requests, urgency, remote-access requests, and suspicious verification patterns.

The two layers provide separate security signals:

```text
Voice Authenticity
        +
Conversation Threat Analysis
        ↓
      VIGIL
```

---

# ✨ Features

## 📁 Audio File Analysis

VIGIL can analyze previously recorded audio.

Supported formats include:

- MP3
- WAV
- M4A
- FLAC
- OGG
- AAC
- Other browser-supported audio formats

Audio is normalized to:

```text
Mono
16 kHz
PCM WAV
```

Processing pipeline:

```text
Audio File
    ↓
FFmpeg
    ↓
16 kHz Mono PCM WAV
    ↓
Librosa
    ↓
Silero VAD
    ↓
Speech Extraction
    ↓
DF-Arena 1B
    ↓
AI / Genuine Classification
```

The interface can display:

- AI probability
- Genuine probability
- Confidence
- Peak AI probability
- Average AI probability
- Number of analyzed windows
- Detection timeline
- Audio waveform
- Suspicious regions
- Detection insights

---

# 🎤 Live Voice Detection

VIGIL continuously captures microphone audio through the browser.

The browser uses the Web Audio API and AudioWorklet to create approximately four-second PCM windows.

```text
Microphone
     ↓
Browser AudioContext
     ↓
AudioWorklet
     ↓
Float32 PCM
     ↓
~4 Second Audio Window
     ↓
FastAPI Backend
     ↓
Audio Preprocessing
     ↓
Silero VAD
     ↓
Speech Audio
     ↓
DF-Arena 1B
     ↓
AI / Genuine Classification
     ↓
Live Detection UI
```

Silero VAD identifies speech before the main detector runs.

The live detector processes analysis windows sequentially to avoid concurrent heavy DF-Arena inference requests.

---

# 📞 Browser VoIP Monitoring

VIGIL includes a browser-based WebRTC environment for demonstrating real-time voice monitoring.

Two browser sessions can participate in the same VIGIL signaling room.

```text
Browser A
    │
    │ Microphone
    ▼
WebRTC Peer-to-Peer Audio
    │
    ▼
Browser B
    │
    │ Remote Audio
    ▼
AudioWorklet
    │
    ▼
~4 Second PCM Windows
    │
    ├─────────────────┐
    ▼                 ▼
DF-Arena          CallShield
    │                 │
    │            Deepgram STT
    │                 │
    │            Conversation
    │              Transcript
    │                 │
    ▼                 ▼
Voice Result      Gemini / Groq
                      │
                      ▼
                 Scam Analysis
```

The VoIP interface supports:

- 🔊 Muting incoming audio
- 🛡️ Enabling/disabling voice detection
- 🛡️ Enabling/disabling CallShield
- 📞 Ending the call
- 🔎 Displaying voice detection results
- 📝 Displaying live transcript
- 🚨 Displaying scam/threat analysis
- 📊 Tracking analyzed windows
- 💾 Saving completed sessions to history

### Important limitation

The current VoIP implementation is a browser-based WebRTC demonstration environment.

It does **not** intercept ordinary cellular/mobile phone calls.

---

# 🛡️ CallShield

CallShield is VIGIL's conversation-level security layer.

DF-Arena primarily answers:

> Does this voice appear genuine or AI-generated?

CallShield addresses:

> Does the conversation contain indicators of a potential scam or social-engineering attack?

The pipeline is:

```text
WebRTC Remote Audio
        ↓
AudioWorklet
        ↓
PCM Audio
        ↓
Deepgram Streaming STT
        ↓
Real-Time Transcript
        ↓
AI Provider
        ↓
Risk Analysis
```

CallShield can produce:

- Risk level
- Risk score
- Reasons
- Recommendation
- Live transcript
- Threat timeline
- Call summary

Example structured result:

```json
{
  "risk_level": "CRITICAL",
  "risk_score": 90,
  "reasons": [
    "Impersonation of a reputable bank",
    "Request for an OTP",
    "Suspicious financial incentive"
  ],
  "recommendation": "Do not provide sensitive information."
}
```

The conversation-analysis prompt is designed to consider combinations of contextual indicators rather than treating an individual keyword as automatic proof of a scam.

---

# 📝 Real-Time Speech Transcription

CallShield uses Deepgram streaming speech-to-text.

The backend:

1. Receives browser audio.
2. Resamples it to 16 kHz when necessary.
3. Streams PCM audio to Deepgram.
4. Receives interim and final transcripts.
5. Sends transcript updates to the frontend.
6. Builds the conversation history.
7. Sends completed conversation segments to the selected AI provider.

Current Deepgram configuration:

- Nova-3
- 16 kHz
- Linear16 PCM
- Mono
- Interim results
- Smart formatting
- Endpointing

---

# 🤖 Gemini / Groq AI Provider Architecture

CallShield uses a provider abstraction so the conversation-analysis provider can be changed without modifying the CallShield WebSocket implementation.

```text
CallShield
    ↓
AIManager
    ↓
AIProvider
    ├── GeminiProvider
    └── GroqProvider
```

The active provider is controlled through `.env`.

```env
SCAM_AI_PROVIDER=gemini
```

or:

```env
SCAM_AI_PROVIDER=groq
```

---

# 🔄 AI Provider Configuration

## Gemini

```env
SCAM_AI_PROVIDER=gemini

GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

## Groq

```env
SCAM_AI_PROVIDER=groq

GROQ_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

The current architecture allows switching between providers by changing one environment variable and restarting the backend.

---

# 🧠 Voice Detection Pipeline

All three voice-input modes use the same core DF-Arena detection engine.

```text
                    INPUT
                      │
          ┌───────────┼───────────┐
          │           │           │
       Upload       Live         VoIP
                    Voice
          │           │           │
          └───────────┼───────────┘
                      ↓
                Audio Ingestion
                      ↓
              FFmpeg Preprocessing
                      ↓
               Mono / 16 kHz PCM
                      ↓
                  Silero VAD
                      ↓
                 Speech Audio
                      ↓
              ~4 Second Windows
                      ↓
                 DF-Arena 1B
                      ↓
                 AI Probability
                      ↓
              Result Aggregation
                 ┌────┴────┐
                 ↓         ↓
              GENUINE      AI
```

---

# 📊 Detection Decision Logic

Each analyzed speech window produces an AI probability.

Current configuration:

```text
AI Threshold = 45%
```

The detector calculates:

- Average AI probability
- Average genuine probability
- Peak AI probability
- Individual window results

The final recording/session verdict is based on the average AI probability across analyzed speech windows.

The highest individual window probability is retained separately as peak AI probability for timeline and forensic analysis.

The 45% threshold is a project configuration and should not be considered a universal threshold for every environment or dataset.

---

# 🤖 DF-Arena 1B

VIGIL currently uses:

```text
Speech-Arena-2025/DF_Arena_1B_V_1
```

The model is used as the core audio anti-spoofing detector.

### Current configuration

| Parameter | Value |
|---|---|
| Model | DF-Arena 1B |
| Architecture | XLS-R + Conformer |
| Sample Rate | 16 kHz |
| Analysis Window | ~4.04 seconds |
| Detection Threshold | 45% |
| Compute | CUDA GPU when available |

The model is downloaded automatically from Hugging Face when the detector initializes.

Model weights are not stored in this repository.

---

# 🏗️ Technology Stack

## Frontend

- React 19
- Vite
- JavaScript
- Lucide React
- WaveSurfer.js
- WebRTC
- Web Audio API
- AudioWorklet
- Browser localStorage

## Backend

- Python 3.11
- FastAPI
- Uvicorn
- Python-dotenv
- FFmpeg
- Librosa
- NumPy
- SciPy
- PyTorch
- TorchAudio
- Silero VAD
- Hugging Face Transformers
- Hugging Face Hub
- Accelerate

## CallShield

- Deepgram SDK
- Streaming Speech-to-Text
- AI provider abstraction
- Google Gemini
- Groq
- OpenAI GPT-OSS 20B through Groq

## Voice Detection

- DF-Arena 1B
- XLS-R
- Conformer-based anti-spoofing architecture
- Silero VAD

---

# 📂 Project Structure

```text
VIGIL/
│
├── .github/
│
├── .gitignore
├── README.md
│
├── backend/
│   │
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── provider.py
│   │   ├── manager.py
│   │   └── providers/
│   │       ├── __init__.py
│   │       ├── gemini.py
│   │       └── groq.py
│   │
│   ├── api/
│   │   ├── detection.py
│   │   ├── live_detection.py
│   │   ├── signaling.py
│   │   └── callshield.py
│   │
│   ├── audio/
│   │   ├── preprocessing.py
│   │   └── vad.py
│   │
│   ├── callshield/
│   │   ├── stt_provider.py
│   │   └── deepgram_transcriber.py
│   │
│   ├── models/
│   │   ├── detector.py
│   │   └── shared.py
│   │
│   ├── utils/
│   │   └── audio_utils.py
│   │
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   ├── test_ai_provider.py
│   └── test_deepgram.py
│
├── frontend/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioAnalyzer.jsx
│   │   │   ├── LiveDetector.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── VoIPDetector.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Analytics.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── History.jsx
│   │   │   └── Settings.jsx
│   │   │
│   │   ├── utils/
│   │   │   └── history.js
│   │   │
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── pcm-recorder-worklet.js
│   │
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
└── .venv/
```

`.venv/`, downloaded model caches, generated audio, environment files, and other local artifacts are not part of the repository.

---

# 💻 System Requirements

VIGIL performs the main DF-Arena inference locally.

### Recommended

- Windows or Linux
- Python 3.11
- Node.js
- FFmpeg
- NVIDIA GPU with CUDA support
- At least 16 GB RAM
- Several GB of free disk space for model files

### Current development environment

```text
CPU: AMD Ryzen 5 5600H
RAM: 16 GB
GPU: NVIDIA GeForce RTX 3050 Laptop GPU
VRAM: 4 GB
Python: 3.11.9
PyTorch: 2.11.0 + CUDA 12.8
```

A CUDA-capable GPU is strongly recommended because DF-Arena 1B is a large model.

CPU inference may be possible but can be substantially slower.

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
```

Open the cloned project in VS Code.

---

# 🐍 Backend Setup

Use Python 3.11.

From the VIGIL project root:

```powershell
py -3.11 -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.venv\Scripts\activate
```

Upgrade pip:

```powershell
python -m pip install --upgrade pip
```

Install backend dependencies:

```powershell
pip install -r backend/requirements.txt
```

> **PyTorch CUDA note:** VIGIL currently uses a CUDA-enabled PyTorch build. When installing on another machine, the appropriate CUDA-enabled PyTorch and TorchAudio builds must be available for that machine.

---

# 🎵 FFmpeg Installation

FFmpeg is required because VIGIL uses it to normalize uploaded and browser-captured audio.

Verify that FFmpeg is available:

```powershell
ffmpeg -version
```

FFmpeg must be available through the system PATH.

FFmpeg is not included in `requirements.txt` because it is a system executable rather than a Python package.

---

# 🔐 Environment Configuration

Create:

```text
backend/.env
```

Use the following structure:

```env
# =========================================================
# VIGIL / CALLSHIELD AI CONFIGURATION
# =========================================================

# Select the conversation-analysis provider.
# Options:
# gemini
# groq
SCAM_AI_PROVIDER=gemini

# =========================================================
# GEMINI
# =========================================================

GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=

# =========================================================
# GROQ
# =========================================================

GROQ_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=

# =========================================================
# DEEPGRAM
# =========================================================

DEEPGRAM_API_KEY=
```

Fill in the required API keys locally.

**Never commit `backend/.env` to Git.**

---

# 🚀 Start the Backend

The backend must be started from the `backend/` directory because the current Python imports use that directory as the application working directory.

Open a VS Code terminal:

```powershell
cd backend
uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

FastAPI documentation:

```text
http://127.0.0.1:8000/docs
```

Health endpoint:

```text
http://127.0.0.1:8000/api/health
```

Expected health response:

```json
{
  "status": "ok",
  "service": "VIGIL backend"
}
```

The first startup may take longer because the DF-Arena model may need to be downloaded and initialized.

---

# ⚛️ Frontend Setup

Open another VS Code terminal.

From the VIGIL project root:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start Vite:

```powershell
npm run dev
```

Vite normally provides:

```text
http://localhost:5173
```

Open the displayed address in the browser.

---

# ▶️ Running VIGIL

Two development processes are required.

### Terminal 1 — Backend

Working directory:

```text
VIGIL/backend/
```

```powershell
uvicorn main:app --reload
```

### Terminal 2 — Frontend

Working directory:

```text
VIGIL/frontend/
```

```powershell
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# 🔐 Authentication

VIGIL currently includes a login and signup interface.

The current implementation is **local/demo authentication**.

Account information is stored in browser localStorage and authentication state can use localStorage or sessionStorage.

This is intended for the SIH prototype/demo environment.

It is not production-grade authentication.

There is currently:

- No backend user database
- No password hashing
- No JWT authentication
- No server-side account management
- No production identity provider

A production deployment would require a proper authentication system.

---

# 📁 Using Audio Analysis

1. Open VIGIL.
2. Log in or create a local demo account.
3. Open **Analyze Audio**.
4. Select an audio file.
5. The browser uploads the file to the VIGIL backend.
6. FFmpeg converts it to the standardized audio format.
7. Librosa loads the audio.
8. Silero VAD identifies speech.
9. Speech segments are extracted.
10. DF-Arena analyzes the speech.
11. VIGIL displays the detection result.
12. The result can be saved to local history.

---

# 🎤 Using Live Voice Detection

1. Open **Live Voice**.
2. Allow microphone access.
3. Start detection.
4. The browser captures microphone audio.
5. AudioWorklet creates approximately 4-second PCM windows.
6. Windows are sent to `/api/live-detect`.
7. The backend performs preprocessing.
8. Silero VAD detects speech.
9. DF-Arena analyzes the speech.
10. Results are displayed continuously.
11. Stop the session when finished.
12. The completed session can be saved to history.

---

# 📞 Using VoIP Monitoring

The current VoIP system is designed for a two-browser demonstration.

### Browser 1

1. Open VIGIL.
2. Open **VoIP Monitor**.
3. Start a call.
4. Allow microphone access.
5. Wait for the second browser to join.

### Browser 2

1. Open VIGIL in another browser window.
2. Open **VoIP Monitor**.
3. Start a call.
4. Allow microphone access.
5. Join the same signaling session.

Once connected:

```text
Browser A
    ↓
WebRTC
    ↓
Browser B
    ↓
Remote Audio
    ↓
AudioWorklet
    ↓
DF-Arena
```

CallShield can simultaneously process the conversation:

```text
Remote Audio
    ↓
PCM
    ↓
Deepgram
    ↓
Transcript
    ↓
Gemini / Groq
    ↓
Risk Analysis
```

---

# 🧪 Testing

## AI Provider Test

The provider test is:

```text
backend/test_ai_provider.py
```

It uses `AIManager`, so it tests whichever provider is selected through:

```env
SCAM_AI_PROVIDER
```

Run from `VIGIL/backend/`:

```powershell
python test_ai_provider.py
```

This verifies:

- Provider loading
- API key configuration
- Provider response
- Structured response parsing

## Deepgram Test

The standalone Deepgram diagnostic test is:

```text
backend/test_deepgram.py
```

Run from `VIGIL/backend/`:

```powershell
python test_deepgram.py
```

This is a development diagnostic and is not required for normal VIGIL operation.

---

# 📊 Detection History

VIGIL stores detection history locally in the browser using:

```text
localStorage
```

Stored information can include:

- Detection source
- Timestamp
- Verdict
- Confidence
- AI probability
- Genuine probability
- Peak AI probability
- Duration
- Number of analyzed windows
- Detection model
- Speech detection information
- CallShield risk
- Risk score
- Threat reasons
- Recommendations

No database server is currently required.

---

# 📈 Analytics

The Analytics page derives statistics from locally stored VIGIL history.

It provides:

- Total analyses
- AI detections
- Genuine voices
- Detection rate
- Average confidence
- Input source distribution
- Threat overview
- CallShield risk distribution
- Recent analyses

These statistics describe the analyses performed through the current VIGIL installation.

---

# 📋 History

The History page allows previously stored analyses to be reviewed.

Depending on the analysis type, it can display:

- Verdict
- Confidence
- AI probability
- Genuine probability
- Peak AI probability
- Duration
- Number of windows
- Detection model
- Speech detection information
- CallShield risk
- Risk score
- Threat reasons
- Recommendations

History can be cleared from the application.

---

# ⚙️ Settings

The Settings page provides local application preferences.

### Auto-save Detection History

Controls whether completed analyses are automatically stored in browser localStorage.

### Show Confidence Scores

Controls whether confidence/probability values are displayed throughout the application.

Core detection parameters such as the model, sample rate, and threshold are managed by the backend.

---

# 🩺 Backend Health Monitoring

The backend exposes:

```text
GET /api/health
```

The Dashboard polls this endpoint to determine whether the VIGIL backend is reachable.

Expected response:

```json
{
  "status": "ok",
  "service": "VIGIL backend"
}
```

---

# 🔐 Privacy

The core DF-Arena voice detection process runs locally through the VIGIL backend.

The current system:

- Runs the main backend locally
- Performs DF-Arena inference locally
- Stores detection history in browser localStorage
- Does not require a paid cloud service for DF-Arena inference
- Does not store model weights in the Git repository
- Sends browser-captured audio to the locally running VIGIL backend

However, CallShield uses external services.

When CallShield is enabled:

```text
Browser Audio
    ↓
Local VIGIL Backend
    ↓
Deepgram
```

The resulting transcript/conversation analysis is then sent to the selected AI provider:

```text
Transcript
    ↓
Gemini OR Groq
```

Therefore, CallShield is not an offline-only feature.

---

# 🛡️ Security Considerations

VIGIL is a prototype voice anti-spoofing and conversation-threat detection system.

Detection performance can vary depending on:

- Audio quality
- Background noise
- Compression
- Microphone characteristics
- Speaker characteristics
- Recording conditions
- Language
- Accent
- Voice-cloning technology
- Attack type
- Dataset/domain differences

The configured 45% AI probability threshold is a development configuration.

It should not be considered a universal threshold for every environment or real-world voice-cloning system.

CallShield's risk score is an AI-generated security assessment and should be treated as an additional security signal rather than definitive proof that a conversation is fraudulent.

---

# 🧪 Development Evaluation

VIGIL was evaluated during development using a local test set and additional audio samples.

On the local 38-sample evaluation set:

```text
Total samples:       38
AI-generated:        19
Genuine:              19
```

Observed results:

```text
AI detected:          17 / 19
Genuine detected:     19 / 19

False positives:       0
False negatives:       2

Accuracy:           94.74%
Precision:         100.00%
Recall:             89.47%
F1 Score:           94.44%
```

These figures describe the specific development evaluation set.

They should not be interpreted as universal real-world detection accuracy.

Performance can change with:

- Different voice-cloning systems
- Different speakers
- Different languages
- Different microphones
- Different codecs
- Background noise
- Dataset distribution

Larger and more diverse evaluation datasets are required for broader performance claims.

---

# ⚠️ Current Limitations

## Voice Detection

- DF-Arena inference is computationally intensive.
- GPU acceleration is strongly recommended.
- Detection quality depends on input audio characteristics.
- The 45% threshold is development-configured.
- The current evaluation dataset is relatively small.

## VoIP

- Current VoIP functionality uses browser WebRTC.
- It does not intercept ordinary cellular calls.
- The signaling server is intended for the VIGIL demonstration environment.
- It is not production-grade public WebRTC infrastructure.

## CallShield

- Deepgram is used for speech-to-text.
- Gemini or Groq is used for conversation analysis.
- External API availability and latency can affect CallShield.
- AI-generated risk assessments can contain errors.
- Conversation analysis should be treated as an additional security signal, not absolute proof.

## Storage

- History is stored in browser localStorage.
- There is currently no centralized database.
- Clearing browser data can remove stored history.

## Authentication

- Login/signup is currently local/demo authentication.
- It is not intended for production security.

---

# 🔮 Future Improvements

Potential future improvements include:

- Real telephone platform integrations
- SIP/VoIP integrations
- More robust WebRTC infrastructure
- Advanced temporal smoothing
- Multi-model voice detection ensembles
- Speaker verification
- Larger and more diverse evaluation datasets
- Automatic threat alerts
- Real-time security notifications
- Forensic report generation
- Database-backed history
- Production authentication
- Role-based access control
- Centralized deployment
- Mobile deployment
- Additional deepfake detection models
- Improved multilingual detection
- Model calibration
- Attack-specific detection
- Security-event logging

---

# 🏗️ Overall Architecture

VIGIL consists of three major subsystems.

## 1. Voice Authenticity Detection

```text
Audio
  ↓
Preprocessing
  ↓
Silero VAD
  ↓
Speech Segmentation
  ↓
DF-Arena 1B
  ↓
AI Probability
  ↓
Voice Verdict
```

## 2. CallShield

```text
VoIP Audio
    ↓
AudioWorklet
    ↓
FastAPI WebSocket
    ↓
Deepgram Streaming STT
    ↓
Conversation Transcript
    ↓
AIManager
    ↓
Gemini / Groq
    ↓
Risk Assessment
```

## 3. Frontend

```text
React
  │
  ├── Dashboard
  ├── Audio Analyzer
  ├── Live Detector
  ├── VoIP Monitor
  ├── History
  ├── Analytics
  └── Settings
        │
        ▼
     FastAPI
```

---

# 🔌 Backend API

### Audio Detection

```text
POST /api/detect
```

Used for uploaded audio files.

### Live Detection

```text
POST /api/live-detect
```

Used by the browser live microphone detector.

### Health Check

```text
GET /api/health
```

Used to verify backend availability.

### WebRTC Signaling

```text
WebSocket /ws/{room_id}
```

Used for browser-to-browser WebRTC signaling.

### CallShield

```text
WebSocket /ws/callshield
```

Used for:

- PCM audio streaming
- Deepgram transcription
- Conversation accumulation
- AI analysis
- Scam analysis results

---

# 📡 WebSocket Architecture

VIGIL uses two separate WebSocket systems.

## WebRTC Signaling

```text
/ws/{room_id}
```

Responsible for:

- Offer exchange
- Answer exchange
- ICE candidates
- Peer join/leave events

## CallShield

```text
/ws/callshield
```

Responsible for:

- Audio streaming
- Transcription
- Conversation accumulation
- AI analysis
- Scam analysis results

The specific CallShield route is registered before the generic signaling route so `/ws/callshield` is handled correctly.

---

# 📦 Frontend Dependencies

The current frontend uses:

- React
- React DOM
- Vite
- Lucide React
- WaveSurfer.js

All current frontend dependencies are actively used.

The lockfile:

```text
frontend/package-lock.json
```

should remain committed to the repository.

---

# 🧹 Repository Hygiene

The repository intentionally excludes:

- Python virtual environments
- Node modules
- Environment files
- Downloaded model weights
- Audio files
- Temporary files
- Build output
- Python caches
- Editor-specific files

Important excluded items include:

```text
.env
.venv/
node_modules/
*.wav
*.mp3
*.safetensors
*.pt
*.pth
```

---

# 🚫 Removed Legacy Components

The older local Whisper transcription implementation was removed.

Removed files:

```text
backend/callshield/transcriber.py
backend/test_microphone.py
backend/test_transcriber.py
```

The old `faster-whisper` path is no longer part of the current VIGIL architecture.

CallShield now uses Deepgram Streaming STT through:

```text
backend/callshield/deepgram_transcriber.py
```

---

# 🧩 Design Principles

### 1. Modular Detection

The voice detector is isolated from the API layer.

### 2. Shared Model Instance

The DF-Arena model is initialized through:

```text
backend/models/shared.py
```

so multiple API routes can reuse the same detector instead of loading the 1B model repeatedly.

### 3. Provider Independence

CallShield does not directly depend on a single AI provider.

```text
CallShield
    ↓
AIManager
    ↓
AIProvider
    ↓
Gemini / Groq
```

### 4. Local Voice Inference

The core DF-Arena voice analysis runs locally.

### 5. Separate Security Signals

VIGIL separates:

```text
VOICE AUTHENTICITY
```

from:

```text
CONVERSATION THREAT ANALYSIS
```

This allows a call to be evaluated from multiple security perspectives.

---

# 🗺️ Development Status

| Component | Status |
|---|---|
| Audio upload detection | ✅ Working |
| DF-Arena 1B inference | ✅ Working |
| Silero VAD | ✅ Working |
| Live microphone detection | ✅ Working |
| WebRTC signaling | ✅ Working |
| Browser VoIP monitoring | ✅ Working |
| Deepgram streaming transcription | ✅ Working |
| CallShield conversation analysis | ✅ Working |
| Gemini provider | ✅ Working |
| Groq provider | ✅ Working |
| Provider switching | ✅ Working |
| Detection history | ✅ Working |
| Analytics | ✅ Working |
| Settings | ✅ Working |
| Local/demo authentication | ✅ Working |
| Backend health monitoring | ✅ Working |
| Cellular call interception | ❌ Not implemented |
| Production authentication | ❌ Not implemented |
| Central database | ❌ Not implemented |

---

# 📜 License

No project license has been selected yet.

A license should be added once the project team decides which open-source license to use.

---

# 👥 Project

**VIGIL — Smart India Hackathon 2026**

**Category:** Software

**Theme:** Blockchain & Cybersecurity

**Problem Statement:**  
**AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks**

VIGIL combines:

```text
AI Voice Detection
        +
Real-Time Speech Transcription
        +
Conversation Threat Analysis
        +
WebRTC Voice Monitoring
        +
Security Analytics
```

to create a unified prototype for detecting and responding to modern voice-based impersonation threats.
