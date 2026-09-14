# VIGIL

### AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks

VIGIL is an AI-powered voice authenticity detection system designed to detect synthetic, cloned, and spoofed human voices.

It provides a unified detection pipeline for:

- 🎤 Live microphone voice analysis
- 📞 Browser-based VoIP voice monitoring
- 📁 Audio file analysis
- 📊 Detection history and analytics
- ⚙️ Local detection preferences

VIGIL uses the **DF-Arena 1B** anti-spoofing model and processes audio through a standardized speech-analysis pipeline.

---

## 🎯 Problem Statement

**AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks**

VIGIL aims to help identify AI-generated or cloned voices that may be used for impersonation, social engineering, fraud, and other voice-based attacks.

The system combines real-time audio capture, voice activity detection, audio preprocessing, and an AI anti-spoofing model into a single application.

---

# ✨ Features

## 📁 Audio Upload

Analyze previously recorded audio files.

Supported formats include:

- MP3
- WAV
- M4A
- FLAC
- OGG
- AAC

The uploaded audio is converted to:

```text
Mono
16 kHz
PCM WAV
```

VIGIL then analyzes the audio using DF-Arena 1B.

The result provides:

- AI / spoof probability
- Genuine voice probability
- Detection confidence
- Peak AI probability
- Average AI probability
- Number of analysis windows
- Detection timeline
- Audio waveform
- Detection insights

---

## 🎤 Live Voice Detection

VIGIL can continuously capture microphone audio through the browser.

Audio is processed in approximately 4-second windows.

```text
Microphone
     ↓
Browser MediaRecorder
     ↓
4-second Audio Window
     ↓
FastAPI Backend
     ↓
FFmpeg Preprocessing
     ↓
Silero VAD
     ↓
DF-Arena 1B
     ↓
AI / Genuine Classification
     ↓
Live Detection UI
```

Silero VAD is used to determine whether speech is present before running the AI detector.

---

## 📞 VoIP Voice Monitoring

VIGIL includes a browser-based WebRTC voice channel for demonstrating real-time voice monitoring.

Two browser windows can participate in the same VIGIL session.

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
VIGIL Monitor
   │
   ▼
4-second Audio Windows
   │
   ▼
DF-Arena 1B
   │
   ▼
Detection Result
```

The monitoring browser receives the remote participant's audio and analyzes it continuously.

The VoIP system uses:

- WebRTC for peer-to-peer audio
- WebSocket for signaling
- Browser MediaRecorder for audio capture
- The same VIGIL detection pipeline used by the other input modes

The monitor can:

- 🔊 Mute incoming audio
- 🛡️ Enable or disable detection
- 📞 End the call
- 🔎 Display the latest detection result
- 📊 Track analyzed windows
- 💾 Save the completed session to history

> **Important:** The current VoIP implementation is a browser-based WebRTC environment. It does not intercept or monitor ordinary cellular/mobile phone calls.

---

# 🧠 Detection Pipeline

All three input modes eventually use the same core detection engine.

```text
                    INPUT
                      │
          ┌───────────┼───────────┐
          │           │           │
       Upload      Live Voice    VoIP
          │           │           │
          └───────────┼───────────┘
                      ↓
               Audio Ingestion
                      ↓
              FFmpeg Preprocessing
                      ↓
              Mono / 16 kHz / PCM
                      ↓
                 Silero VAD
                      ↓
                Speech Audio
                      ↓
            4-second Analysis Windows
                      ↓
                 DF-Arena 1B
                      ↓
                AI Probability
                      ↓
              Result Aggregation
                      ↓
             ┌────────┴────────┐
             ↓                 ↓
          GENUINE              AI
```

---

# 🤖 AI Detection Model

VIGIL currently uses:

**DF-Arena 1B**

Model:

```text
Speech-Arena-2025/DF_Arena_1B_V_1
```

The model is designed for audio deepfake and anti-spoofing detection.

### Current configuration

| Parameter | Value |
|---|---|
| Model | DF-Arena 1B |
| Architecture | XLS-R + Conformer |
| Sample Rate | 16 kHz |
| Analysis Window | ~4.04 seconds |
| Detection Threshold | 45% |
| Compute | CUDA GPU when available |

The model is downloaded automatically from Hugging Face when VIGIL initializes the detection engine.

**Model weights are not stored in this repository.**

---

# 🏗️ Technology Stack

## Frontend

- React 19
- Vite
- JavaScript
- Lucide React
- WaveSurfer.js
- WebRTC
- MediaRecorder API

## Backend

- Python 3.11
- FastAPI
- Uvicorn
- FFmpeg
- Librosa
- NumPy
- PyTorch
- Silero VAD
- Hugging Face Transformers
- Hugging Face Hub

## AI

- DF-Arena 1B
- XLS-R
- Conformer-based anti-spoofing architecture

---

# 📂 Project Structure

```text
VIGIL/
│
├── .gitignore
├── README.md
│
├── backend/
│   ├── api/
│   │   ├── detection.py
│   │   ├── live_detection.py
│   │   └── signaling.py
│   │
│   ├── audio/
│   │   ├── preprocessing.py
│   │   └── vad.py
│   │
│   ├── models/
│   │   ├── detector.py
│   │   └── shared.py
│   │
│   ├── utils/
│   │   └── audio_utils.py
│   │
│   ├── main.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── AudioAnalyzer.jsx
    │   │   ├── LiveDetector.jsx
    │   │   └── VoIPDetector.jsx
    │   │
    │   ├── pages/
    │   │   ├── History.jsx
    │   │   ├── Analytics.jsx
    │   │   └── Settings.jsx
    │   │
    │   ├── utils/
    │   │   └── history.js
    │   │
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    │
    ├── index.html
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```

---

# 💻 System Requirements

VIGIL performs AI inference locally.

Recommended environment:

- Windows or Linux
- Python 3.11
- Node.js
- FFmpeg
- NVIDIA GPU with CUDA support recommended
- At least 16 GB RAM recommended
- Several GB of free disk space for the AI model

A CUDA-capable GPU significantly improves inference performance.

CPU inference may be possible but can be considerably slower.

---

# ⚙️ Installation

## 1. Clone the Repository

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
```

Open the cloned project in VS Code.

---

# 🐍 Backend Setup

Create a Python 3.11 virtual environment from the VIGIL project root:

```bash
py -3.11 -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

Install the backend dependencies:

```bash
pip install -r backend/requirements.txt
```

---

# 🎵 Install FFmpeg

FFmpeg is required for audio preprocessing.

Verify that FFmpeg is available:

```bash
ffmpeg -version
```

FFmpeg is a system dependency and is therefore not included in `requirements.txt`.

---

# 🚀 Start the Backend

From the VIGIL project root:

```bash
cd backend
```

Then run:

```bash
uvicorn main:app --reload
```

The backend will run at:

```text
http://127.0.0.1:8000
```

FastAPI documentation is available at:

```text
http://127.0.0.1:8000/docs
```

The first startup may take some time because the DF-Arena 1B model may need to be downloaded and loaded.

---

# ⚛️ Frontend Setup

Open another terminal.

From the VIGIL project root:

```bash
cd frontend
```

Install the JavaScript dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Vite will normally provide:

```text
http://localhost:5173
```

Open that address in a browser.

---

# ▶️ Running VIGIL

Two development processes are required.

### Terminal 1 — Backend

```bash
cd backend
uvicorn main:app --reload
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# 📁 Using Audio Analysis

1. Open VIGIL.
2. Navigate to **Analyze Audio**.
3. Select an audio file.
4. VIGIL preprocesses the audio.
5. The detector analyzes the audio windows.
6. The detection result is displayed.
7. The analysis can be stored in local history if auto-save is enabled.

---

# 🎤 Using Live Voice Detection

1. Open **Live Voice**.
2. Allow microphone access.
3. Start detection.
4. VIGIL captures short audio windows.
5. Silero VAD identifies speech.
6. Speech windows are sent to DF-Arena 1B.
7. Results are displayed continuously.
8. Stop the session when finished.

---

# 📞 Using VoIP Monitoring

The current VoIP system is designed for testing between two browser windows.

### Browser 1

1. Open VIGIL.
2. Navigate to **VoIP Monitor**.
3. Select **Start Call**.
4. This browser becomes the caller when another participant joins.

### Browser 2

1. Open VIGIL in another browser window.
2. Navigate to **VoIP Monitor**.
3. Select **Start Call**.
4. This browser becomes the VIGIL monitor.

The monitor receives the caller's WebRTC audio and analyzes it in approximately 4-second windows.

---

# 📊 Detection History

VIGIL stores detection history locally in the browser using `localStorage`.

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

The current implementation does not require a database server.

---

# 📈 Analytics

The Analytics page derives statistics from the locally stored detection history.

It provides:

- Total analyses
- AI detections
- Genuine voices
- Detection rate
- Average confidence
- Analysis source distribution
- Threat overview
- Recent analyses

These statistics describe the analyses performed through the current VIGIL installation.

---

# ⚙️ Settings

The Settings page provides local application preferences.

Currently available:

### Auto-save Detection History

Controls whether completed analyses are automatically stored in browser localStorage.

### Show Confidence Scores

Controls whether confidence/probability values are displayed throughout the application.

Detection engine parameters such as the model, sample rate, and threshold are currently managed by the backend.

---

# 🔐 Privacy

The current VIGIL architecture is designed around local execution.

The application:

- Runs the backend locally.
- Performs AI inference locally.
- Stores detection history in browser localStorage.
- Does not require a paid cloud AI API.
- Does not store model weights in the Git repository.

Audio captured by the browser is sent to the locally running VIGIL backend for analysis.

---

# 🛡️ Security Considerations

VIGIL is a prototype voice anti-spoofing detection system.

Detection performance can vary depending on:

- Audio quality
- Background noise
- Compression
- Speaker characteristics
- Recording conditions
- Voice cloning technology
- Language and accent
- Dataset/domain differences

The configured **45% threshold** is part of the current project configuration and should not be considered a universal threshold for every environment.

---

# 🧪 Evaluation

During development, the configured threshold produced **100% accuracy on a specific 38-sample evaluation set**.

This result should **not** be interpreted as 100% accuracy against real-world voice cloning attacks.

A broader evaluation would require a larger and more diverse dataset containing:

- Multiple speakers
- Multiple voice-cloning systems
- Different recording environments
- Different codecs
- Background noise
- Different languages and accents
- Real telephone/VoIP conditions

---

# ⚠️ Current Limitations

The current implementation has several limitations:

- Browser-based VoIP rather than cellular call interception
- LocalStorage-based detection history
- Local backend deployment
- GPU recommended for practical inference speed
- Detection performance depends on audio quality and attack characteristics
- Current threshold is development-configured rather than universally optimized
- The current WebRTC signaling implementation is intended for the VIGIL demonstration environment

---

# 🔮 Future Improvements

Potential future improvements include:

- Real telephone/VoIP platform integrations
- Advanced temporal smoothing
- Larger and more diverse evaluation datasets
- Multi-model ensemble detection
- Speaker verification
- Risk scoring
- Real-time alerts
- Forensic report generation
- Centralized deployment
- Authentication and user accounts
- Database-backed history
- Mobile deployment
- Additional deepfake detection models

---

# 👥 Development

VIGIL is currently designed as a local development and demonstration system.

The main architecture is:

```text
React Frontend
       ↓
FastAPI Backend
       ↓
Audio Preprocessing
       ↓
Silero VAD
       ↓
DF-Arena 1B
       ↓
Detection Result
       ↓
React Frontend
```

Keep downloaded model files, Python virtual environments, Node modules, caches, and generated audio files outside Git.

The included `.gitignore` prevents these files from being committed.

---

# 📜 License

No project license has been selected yet.

A license should be added once the project team decides which open-source license to use.

---

# 👨‍💻 Team

**VIGIL — Smart India Hackathon 2026**

**Category:** Software

**Theme:** Blockchain & Cybersecurity

**Problem Statement:** AI-Powered Real-Time Detection and Prevention of Voice Cloning Impersonation Attacks