import librosa
import numpy as np


def load_audio(file_path: str):
    """
    Load audio as a mono floating-point waveform
    at 16 kHz.
    """

    audio, sample_rate = librosa.load(
        file_path,
        sr=16000,
        mono=True,
    )

    audio = audio.astype(np.float32)

    return audio, sample_rate