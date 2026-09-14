from pathlib import Path
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from audio.preprocessing import convert_to_wav
from utils.audio_utils import load_audio
from audio.vad import detect_speech
from models.shared import detector


router = APIRouter()


@router.post("/live-detect")
async def live_detect(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No audio chunk provided."
        )

    input_suffix = Path(file.filename).suffix or ".webm"

    temp_input = tempfile.NamedTemporaryFile(
        suffix=input_suffix,
        delete=False
    )

    input_path = temp_input.name
    wav_path = None

    try:
        contents = await file.read()

        temp_input.write(contents)
        temp_input.close()

        # Convert browser audio → 16 kHz mono WAV
        wav_path = convert_to_wav(input_path)

        # Load waveform
        audio, sample_rate = load_audio(wav_path)

        if len(audio) == 0:
            raise HTTPException(
                status_code=400,
                detail="Audio chunk is empty."
            )

        # Check whether speech exists
        speech_segments = detect_speech(
            __import__("torch").from_numpy(audio)
        )

        if not speech_segments:
            return {
                "success": True,
                "speech_detected": False,
                "message": "No speech detected."
            }

        # Run the SAME DF-Arena detector used by uploads
        detection = detector.detect(audio)

        return {
            "success": True,
            "speech_detected": True,
            "duration": round(
                len(audio) / sample_rate,
                2
            ),
            "sample_rate": sample_rate,
            "detection": detection
        }

    except HTTPException:
        raise

    except Exception as error:
        print("LIVE DETECTION ERROR:", error)

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        Path(input_path).unlink(missing_ok=True)

        if wav_path:
            Path(wav_path).unlink(missing_ok=True)