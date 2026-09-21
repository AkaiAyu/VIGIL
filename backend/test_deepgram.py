import os
import queue
import threading
import time

import sounddevice as sd
from dotenv import load_dotenv
from deepgram import DeepgramClient
from deepgram.core.events import EventType


load_dotenv()


SAMPLE_RATE = 16000
CHANNELS = 1

audio_queue = queue.Queue()

stop_event = threading.Event()
recording_done = threading.Event()


def main():
    api_key = os.getenv("DEEPGRAM_API_KEY")

    if not api_key:
        raise RuntimeError(
            "DEEPGRAM_API_KEY is not configured."
        )

    client = DeepgramClient(
        api_key=api_key
    )

    with client.listen.v1.connect(
        model="nova-3",
        language="multi",
        encoding="linear16",
        sample_rate=SAMPLE_RATE,
        channels=CHANNELS,
        smart_format=True,
        interim_results=True,
        endpointing=300,
    ) as connection:

        # -------------------------------------------------
        # DEEPGRAM EVENTS
        # -------------------------------------------------

        def on_open(_):
            print(
                "✅ Deepgram connection opened.",
                flush=True,
            )

        def on_message(message):
            try:
                transcript = (
                    message.channel
                    .alternatives[0]
                    .transcript
                )
            except (AttributeError, IndexError):
                return

            if transcript:
                print(
                    f"\n📝 {transcript}",
                    flush=True,
                )

        def on_error(error):
            print(
                f"\n❌ Deepgram error: {error}",
                flush=True,
            )

        def on_close(_):
            print(
                "\n🔌 Deepgram connection closed.",
                flush=True,
            )

        connection.on(
            EventType.OPEN,
            on_open,
        )

        connection.on(
            EventType.MESSAGE,
            on_message,
        )

        connection.on(
            EventType.ERROR,
            on_error,
        )

        connection.on(
            EventType.CLOSE,
            on_close,
        )

        # -------------------------------------------------
        # MICROPHONE
        # -------------------------------------------------

        audio_callback_count = 0

        def audio_callback(
            indata,
            frames,
            time_info,
            status,
        ):
            nonlocal audio_callback_count

            if status:
                print(
                    f"\n⚠️ Audio status: {status}",
                    flush=True,
                )

            if stop_event.is_set():
                return

            audio_data = indata.tobytes()

            if audio_data:
                audio_queue.put(audio_data)

                audio_callback_count += 1

                if audio_callback_count == 1:
                    print(
                        "🎤 Microphone audio detected.",
                        flush=True,
                    )

        recording = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="int16",
            blocksize=3200,
            callback=audio_callback,
        )

        recording.start()

        print()
        print("=" * 60)
        print("DEEPGRAM MULTILINGUAL MICROPHONE TEST")
        print("=" * 60)
        print()
        print(
            "Speak naturally in English, Hindi, or Hinglish."
        )
        print()
        print("Example:")
        print(
            "Bhai kal mujhe ek suspicious bank call aaya tha."
        )
        print(
            "They were asking me for my OTP."
        )
        print()
        print(
            "🎙️ Microphone is recording..."
        )
        print()

        # -------------------------------------------------
        # AUDIO SENDER THREAD
        # -------------------------------------------------

        def send_audio():
            while True:

                try:
                    audio_data = audio_queue.get(
                        timeout=0.1
                    )
                except queue.Empty:

                    if recording_done.is_set():
                        break

                    continue

                try:
                    connection.send_media(
                        audio_data
                    )

                except Exception as error:
                    print(
                        f"\n❌ Audio send error: {error}",
                        flush=True,
                    )

                    stop_event.set()
                    break

            # Send any remaining audio before
            # finalizing the Deepgram stream.
            while not audio_queue.empty():

                try:
                    audio_data = audio_queue.get_nowait()

                    connection.send_media(
                        audio_data
                    )

                except queue.Empty:
                    break

                except Exception:
                    break

            try:
                connection.send_finalize()

            except Exception as error:
                print(
                    f"\n⚠️ Finalize error: {error}",
                    flush=True,
                )

        sender_thread = threading.Thread(
            target=send_audio,
            daemon=True,
        )

        sender_thread.start()

        # -------------------------------------------------
        # WAIT FOR USER TO PRESS ENTER
        # -------------------------------------------------

        def wait_for_stop():
            input(
                "Press ENTER to stop recording: "
            )

            print(
                "\n⏹️ Stopping microphone..."
            )

            stop_event.set()

            recording.stop()
            recording.close()

            recording_done.set()

            sender_thread.join(
                timeout=3
            )

            # Give Deepgram time to return
            # the final transcript.
            time.sleep(2)

            try:
                connection.send_close_stream()

            except Exception:
                pass

            # start_listening() is blocking, so we
            # need to close the underlying socket
            # after the final results arrive.
            try:
                connection._websocket.close()

            except Exception:
                pass

        stop_thread = threading.Thread(
            target=wait_for_stop,
            daemon=True,
        )

        stop_thread.start()

        # -------------------------------------------------
        # IMPORTANT:
        #
        # start_listening() BLOCKS the current thread.
        # That is why microphone + sender are running
        # in background threads above.
        # -------------------------------------------------

        connection.start_listening()

        stop_thread.join(
            timeout=5
        )

    print()
    print("=" * 60)
    print("DEEPGRAM TEST FINISHED")
    print("=" * 60)


if __name__ == "__main__":
    main()