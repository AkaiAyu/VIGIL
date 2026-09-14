import torch
from silero_vad import load_silero_vad, get_speech_timestamps


# Load the VAD model once when the backend starts.
model = load_silero_vad()


def detect_speech(audio: torch.Tensor):
    """
    Detect speech regions in a 16 kHz audio waveform.

    Returns a list of speech segments containing
    start and end sample positions.
    """

    speech_timestamps = get_speech_timestamps(
        audio,
        model,
        sampling_rate=16000,
    )

    return speech_timestamps