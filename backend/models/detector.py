import numpy as np
import torch
from huggingface_hub import snapshot_download
from transformers import pipeline

# ============================================================
# CONFIGURATION
# ============================================================

MODEL_ID = "Speech-Arena-2025/DF_Arena_1B_V_1"

SAMPLE_RATE = 16000

# DF-Arena expects 64,600 samples
# 64,600 / 16,000 ≈ 4.04 seconds
WINDOW_SAMPLES = 64600

# Non-overlapping windows
HOP_SAMPLES = WINDOW_SAMPLES

# Minimum useful audio length
MIN_AUDIO_SAMPLES = 16000

# Final decision threshold.
#
# The recording verdict is based on the average AI
# probability across all analyzed windows.
#
# The maximum single-window probability is retained
# separately as forensic information.
AI_THRESHOLD = 0.45


# ============================================================
# VOICE DETECTOR
# ============================================================


class VoiceDetector:

    def __init__(self):

        print("Loading VIGIL voice detector...")

        # ----------------------------------------------------
        # Select device
        # ----------------------------------------------------

        if torch.cuda.is_available():
            self.device = "cuda:0"
            print(f"Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            self.device = "cpu"
            print("CUDA not available. Using CPU.")

        # ----------------------------------------------------
        # Download / locate model
        # ----------------------------------------------------

        print("Checking DF-Arena 1B model...")

        self.model_path = snapshot_download(repo_id=MODEL_ID)

        print(f"Model path: {self.model_path}")

        # ----------------------------------------------------
        # Load model
        # ----------------------------------------------------

        print("Loading DF-Arena 1B...")

        self.detector = pipeline(
            "antispoofing",
            model=self.model_path,
            trust_remote_code=True,
            device=self.device,
        )

        print("DF-Arena 1B loaded successfully.")
        print(f"Model device: {self.device}")

    # ========================================================
    # ANALYZE ONE WINDOW
    # ========================================================

    def _analyze_window(self, audio_window):

        result = self.detector(audio_window)

        # ----------------------------------------------------
        # Extract probabilities
        # ----------------------------------------------------

        if isinstance(result, dict):

            spoof_probability = result.get("all_scores", {}).get(
                "spoof", result.get("score", 0.0)
            )

            bonafide_probability = result.get("all_scores", {}).get(
                "bonafide", 1.0 - spoof_probability
            )

        else:

            raise RuntimeError(f"Unexpected detector output: {result}")

        return {
            "ai_probability": float(spoof_probability),
            "genuine_probability": float(bonafide_probability),
        }

    # ========================================================
    # CREATE NON-OVERLAPPING WINDOWS
    # ========================================================

    def _create_windows(self, audio):

        audio_length = len(audio)

        # ----------------------------------------------------
        # Very short audio
        # ----------------------------------------------------

        if audio_length < MIN_AUDIO_SAMPLES:

            raise ValueError(
                "Audio is too short. " "At least 1 second of audio is required."
            )

        windows = []

        # ----------------------------------------------------
        # Audio shorter than model window
        # ----------------------------------------------------

        if audio_length <= WINDOW_SAMPLES:

            window = np.zeros(WINDOW_SAMPLES, dtype=np.float32)

            window[:audio_length] = audio

            windows.append(
                {
                    "audio": window,
                    "start": 0,
                    "end": WINDOW_SAMPLES,
                }
            )

            return windows

        # ----------------------------------------------------
        # Normal non-overlapping windows
        # ----------------------------------------------------

        start = 0

        while start < audio_length:

            end = start + WINDOW_SAMPLES

            window = audio[start:end]

            # ----------------------------------------------
            # Pad final window
            # ----------------------------------------------

            if len(window) < WINDOW_SAMPLES:

                padded_window = np.zeros(WINDOW_SAMPLES, dtype=np.float32)

                padded_window[: len(window)] = window

                window = padded_window

            windows.append(
                {
                    "audio": window.astype(np.float32),
                    "start": start,
                    "end": end,
                }
            )

            # ----------------------------------------------
            # Stop after final window
            # ----------------------------------------------

            if end >= audio_length:
                break

            start += HOP_SAMPLES

        return windows

    # ========================================================
    # MAIN DETECTION FUNCTION
    # ========================================================

    def detect(self, audio):

        # ----------------------------------------------------
        # Validate input
        # ----------------------------------------------------

        if not isinstance(audio, np.ndarray):

            raise TypeError("Audio must be a NumPy array.")

        if audio.ndim != 1:

            raise ValueError("Audio must be mono (1-dimensional).")

        audio = audio.astype(np.float32)

        # ----------------------------------------------------
        # Create windows
        # ----------------------------------------------------

        windows = self._create_windows(audio)

        print(f"Analyzing {len(windows)} audio windows...")

        window_results = []

        ai_scores = []
        genuine_scores = []

        # ----------------------------------------------------
        # Analyze every window
        # ----------------------------------------------------

        for index, window_data in enumerate(windows, start=1):

            start_seconds = window_data["start"] / SAMPLE_RATE

            end_seconds = window_data["end"] / SAMPLE_RATE

            print(
                f"Window {index}/{len(windows)} "
                f"({start_seconds:.2f}s → "
                f"{end_seconds:.2f}s)"
            )

            result = self._analyze_window(window_data["audio"])

            ai_probability = result["ai_probability"]

            genuine_probability = result["genuine_probability"]

            ai_scores.append(ai_probability)

            genuine_scores.append(genuine_probability)

            window_results.append(
                {
                    "start": round(start_seconds, 2),
                    "end": round(end_seconds, 2),
                    "ai_probability": round(ai_probability * 100, 2),
                    "genuine_probability": round(genuine_probability * 100, 2),
                }
            )

            print(f"  AI: " f"{ai_probability * 100:.2f}%")

            print(f"  Genuine: " f"{genuine_probability * 100:.2f}%")

        # ====================================================
        # AGGREGATION
        # ====================================================

        average_ai = float(np.mean(ai_scores))

        average_genuine = float(np.mean(genuine_scores))

        maximum_ai = float(np.max(ai_scores))

        # ----------------------------------------------------
        # FINAL DECISION LOGIC
        #
        # Use the average AI probability across all
        # analyzed windows for the final recording verdict.
        #
        # The highest single-window AI score is retained
        # separately as forensic information only.
        # ----------------------------------------------------

        if average_ai >= AI_THRESHOLD:

            verdict = "AI"

            confidence = average_ai

        else:

            verdict = "GENUINE"

            confidence = 1.0 - average_ai

        # ====================================================
        # RETURN RESULT
        # ====================================================

        return {
            "verdict": verdict,
            "confidence": round(confidence * 100, 2),
            "ai_probability": round(average_ai * 100, 2),
            "genuine_probability": round(average_genuine * 100, 2),
            "maximum_ai_probability": round(maximum_ai * 100, 2),
            "threshold": round(AI_THRESHOLD * 100, 2),
            "windows_analyzed": len(window_results),
            "window_results": window_results,
            "model": "DF-Arena 1B",
        }
