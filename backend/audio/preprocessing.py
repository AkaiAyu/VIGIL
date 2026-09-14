import subprocess
from pathlib import Path
import tempfile


def convert_to_wav(input_path: str) -> str:
    """
    Convert an input audio file to:
    - WAV
    - mono
    - 16 kHz
    - PCM 16-bit
    """

    input_path = Path(input_path)

    output_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    )
    output_path = output_file.name
    output_file.close()

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        output_path,
    ]

    subprocess.run(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )

    return output_path