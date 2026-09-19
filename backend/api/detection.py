from pathlib import Path
import tempfile

import numpy as np
import torch
from fastapi import APIRouter, UploadFile, File, HTTPException

from audio.preprocessing import convert_to_wav
from audio.vad import detect_speech
from utils.audio_utils import load_audio
from models.shared import detector


router = APIRouter()


@router.post("/detect")
async def detect_voice(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

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

        # Convert uploaded audio to mono 16 kHz WAV
        wav_path = convert_to_wav(input_path)

        audio, sample_rate = load_audio(wav_path)

        if len(audio) == 0:
            raise HTTPException(
                status_code=400,
                detail="Audio file is empty."
            )

        # Detect speech regions using Silero VAD
        speech_segments = detect_speech(
            torch.from_numpy(audio)
        )

        if not speech_segments:
            return {
                "success": True,
                "filename": file.filename,
                "duration": round(len(audio) / sample_rate, 2),
                "sample_rate": sample_rate,
                "speech_detected": False,
                "message": "No speech detected."
            }

        # Extract speech-only portions
        speech_parts = []

        for segment in speech_segments:
            start = int(segment["start"])
            end = int(segment["end"])

            if end > start:
                speech_parts.append(audio[start:end])

        if not speech_parts:
            return {
                "success": True,
                "filename": file.filename,
                "duration": round(len(audio) / sample_rate, 2),
                "sample_rate": sample_rate,
                "speech_detected": False,
                "message": "No usable speech detected."
            }

        speech_audio = np.concatenate(speech_parts)

        # Require at least 1 second of speech
        if len(speech_audio) < sample_rate:
            return {
                "success": True,
                "filename": file.filename,
                "duration": round(len(audio) / sample_rate, 2),
                "sample_rate": sample_rate,
                "speech_detected": False,
                "message": "Speech segment too short for reliable analysis."
            }

        # Run DF-Arena only on speech audio
        detection = detector.detect(speech_audio)

        speech_duration = len(speech_audio) / sample_rate

        return {
            "success": True,
            "filename": file.filename,
            "duration": round(len(audio) / sample_rate, 2),
            "speech_duration": round(speech_duration, 2),
            "sample_rate": sample_rate,
            "speech_detected": True,
            "detection": detection
        }

    except HTTPException:
        raise

    except Exception as error:
        print("UPLOAD DETECTION ERROR:", error)
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        Path(input_path).unlink(missing_ok=True)

        if wav_path:
            Path(wav_path).unlink(missing_ok=True)