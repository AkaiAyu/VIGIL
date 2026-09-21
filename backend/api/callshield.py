import asyncio
import json

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from scipy.signal import resample_poly

from ai.manager import AIManager
from callshield.deepgram_transcriber import DeepgramTranscriber


router = APIRouter()


def resample_pcm(
    audio_bytes: bytes,
    input_sample_rate: int,
    output_sample_rate: int = 16000,
) -> bytes:
    if input_sample_rate == output_sample_rate:
        return audio_bytes

    samples = np.frombuffer(
        audio_bytes,
        dtype=np.int16,
    )

    if samples.size == 0:
        return b""

    gcd = np.gcd(
        input_sample_rate,
        output_sample_rate,
    )

    up = output_sample_rate // gcd
    down = input_sample_rate // gcd

    resampled = resample_poly(
        samples.astype(np.float32),
        up,
        down,
    )

    resampled = np.clip(
        resampled,
        -32768,
        32767,
    ).astype(np.int16)

    return resampled.tobytes()


@router.websocket("/ws/callshield")
async def callshield_websocket(
    websocket: WebSocket,
):
    await websocket.accept()

    transcriber = None
    ai_manager = AIManager()

    loop = asyncio.get_running_loop()

    input_sample_rate = 48000

    conversation = []

    analyzed_turn_count = 0

    analysis_lock = asyncio.Lock()

    async def safe_send(payload: dict):
        try:
            await websocket.send_json(payload)
        except Exception:
            pass

    async def analyze_conversation():
        nonlocal analyzed_turn_count

        async with analysis_lock:

            if len(conversation) <= analyzed_turn_count:
                return

            current_conversation = "\n".join(
                conversation
            )

            try:

                result = await asyncio.to_thread(
                    ai_manager.analyze_conversation,
                    current_conversation,
                )

                analyzed_turn_count = len(
                    conversation
                )

                print(
                    "CALLSHIELD AI ANALYSIS:",
                    result,
                )

                await safe_send({
                    "type": "scam-analysis",
                    "analysis": result,
                })

            except Exception as error:

                print(
                    f"CALLSHIELD AI ERROR: {error}"
                )

                await safe_send({
                    "type": "scam-analysis-error",
                    "message": str(error),
                })

    def handle_transcript(
        text: str,
        is_final: bool,
    ):

        if not text:
            return

        asyncio.run_coroutine_threadsafe(
            safe_send({
                "type": "transcript",
                "text": text,
                "is_final": is_final,
            }),
            loop,
        )

        if not is_final:
            return

        conversation.append(
            text.strip()
        )

        print(
            "CALLSHIELD FINAL TRANSCRIPT:",
            text,
        )

        # Analyze every 2 completed speech segments.
        if (
            len(conversation) - analyzed_turn_count
            >= 2
        ):
            asyncio.run_coroutine_threadsafe(
                analyze_conversation(),
                loop,
            )

    try:

        while True:

            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            text_data = message.get("text")

            if text_data:

                try:

                    config = json.loads(
                        text_data
                    )

                    if config.get("type") == "config":

                        input_sample_rate = int(
                            config.get(
                                "sample_rate",
                                48000,
                            )
                        )

                        print(
                            "CALLSHIELD INPUT SAMPLE RATE:",
                            input_sample_rate,
                        )

                        if transcriber is None:

                            transcriber = (
                                DeepgramTranscriber(
                                    sample_rate=16000,
                                    channels=1,
                                )
                            )

                            transcriber.set_transcript_callback(
                                handle_transcript
                            )

                            transcriber.start()

                            await safe_send({
                                "type": "status",
                                "status": "connected",
                            })

                except Exception as error:

                    print(
                        "CALLSHIELD CONFIG ERROR:",
                        error,
                    )

                continue

            audio_bytes = message.get(
                "bytes"
            )

            if not audio_bytes:
                continue

            if transcriber is None:

                print(
                    "CALLSHIELD AUDIO RECEIVED "
                    "BEFORE CONFIG"
                )

                continue

            converted_audio = resample_pcm(
                audio_bytes,
                input_sample_rate,
                16000,
            )

            transcriber.send_audio(
                converted_audio
            )

    except WebSocketDisconnect:

        print(
            "CALLSHIELD CLIENT DISCONNECTED"
        )

    except Exception as error:

        print(
            f"CALLSHIELD WEBSOCKET ERROR: {error}"
        )

    finally:

        if transcriber:
            transcriber.stop()

        # If there are unanalysed final transcripts,
        # perform one last analysis.
        if len(conversation) > analyzed_turn_count:

            try:

                await analyze_conversation()

            except Exception as error:

                print(
                    "CALLSHIELD FINAL AI ERROR:",
                    error,
                )