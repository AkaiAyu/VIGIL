from pathlib import Path
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from audio.preprocessing import convert_to_wav
from utils.audio_utils import load_audio
from models.shared import detector


router = APIRouter()


# ============================================================
# VOICE DETECTION ENDPOINT
# ============================================================

@router.post("/detect")
async def detect_voice(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No audio file provided."
        )

    input_suffix = Path(file.filename).suffix

    temp_input = tempfile.NamedTemporaryFile(
        suffix=input_suffix,
        delete=False
    )

    input_path = temp_input.name

    wav_path = None

    try:

        # ----------------------------------------------------
        # Save uploaded file temporarily
        # ----------------------------------------------------

        contents = await file.read()

        temp_input.write(contents)
        temp_input.close()

        # ----------------------------------------------------
        # Convert to 16 kHz mono WAV
        # ----------------------------------------------------

        wav_path = convert_to_wav(
            input_path
        )

        # ----------------------------------------------------
        # Load audio
        # ----------------------------------------------------

        audio, sample_rate = load_audio(
            wav_path
        )

        # ----------------------------------------------------
        # Run VIGIL detector
        # ----------------------------------------------------

        detection = detector.detect(
            audio
        )

        # ----------------------------------------------------
        # Return result
        # ----------------------------------------------------

        return {
            "success": True,

            "filename": file.filename,

            "duration": round(
                len(audio) / sample_rate,
                2
            ),

            "sample_rate": sample_rate,

            "detection": detection
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        # ----------------------------------------------------
        # Clean temporary files
        # ----------------------------------------------------

        Path(input_path).unlink(
            missing_ok=True
        )

        if wav_path:

            Path(wav_path).unlink(
                missing_ok=True
            )