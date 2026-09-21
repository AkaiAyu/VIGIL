import os
import threading

from dotenv import load_dotenv
from deepgram import DeepgramClient
from deepgram.core.events import EventType

from callshield.stt_provider import STTProvider


load_dotenv()


class DeepgramTranscriber(STTProvider):
    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        self.sample_rate = sample_rate
        self.channels = channels

        self.api_key = os.getenv("DEEPGRAM_API_KEY")

        if not self.api_key:
            raise RuntimeError(
                "DEEPGRAM_API_KEY is not configured."
            )

        self.client = DeepgramClient(
            api_key=self.api_key
        )

        self.connection = None
        self.connection_context = None
        self.receive_thread = None

        self.transcript_callback = None

        self.running = False
        self.connected = False

    def set_transcript_callback(self, callback):
        self.transcript_callback = callback

    def start(self):
        if self.running:
            return

        self.running = True

        self.receive_thread = threading.Thread(
            target=self._listen,
            daemon=True,
        )

        self.receive_thread.start()

    def _listen(self):
        try:
            self.connection_context = (
                self.client.listen.v1.connect(
                    model="nova-3",
                    language="multi",
                    encoding="linear16",
                    sample_rate=self.sample_rate,
                    channels=self.channels,
                    smart_format=True,
                    interim_results=True,
                    endpointing=300,
                )
            )

            with self.connection_context as connection:
                self.connection = connection

                connection.on(
                    EventType.OPEN,
                    self._on_open,
                )

                connection.on(
                    EventType.MESSAGE,
                    self._on_message,
                )

                connection.on(
                    EventType.ERROR,
                    self._on_error,
                )

                connection.on(
                    EventType.CLOSE,
                    self._on_close,
                )

                print(
                    "CALLSHIELD DEEPGRAM STREAM STARTING"
                )

                connection.start_listening()

        except Exception as error:
            print(
                f"CALLSHIELD DEEPGRAM ERROR: {error}"
            )

        finally:
            self.connection = None
            self.connection_context = None
            self.connected = False

    def _on_open(self, _):
        self.connected = True

        print(
            "CALLSHIELD DEEPGRAM CONNECTED"
        )

    def _on_message(self, message):
        try:
            transcript = (
                message
                .channel
                .alternatives[0]
                .transcript
            )
        except (AttributeError, IndexError):
            return

        if not transcript:
            return

        is_final = getattr(
            message,
            "is_final",
            False,
        )

        if self.transcript_callback:
            self.transcript_callback(
                transcript,
                is_final,
            )

    def _on_error(self, error):
        print(
            f"CALLSHIELD DEEPGRAM ERROR: {error}"
        )

    def _on_close(self, _):
        self.connected = False

        print(
            "CALLSHIELD DEEPGRAM DISCONNECTED"
        )

    def send_audio(self, audio_bytes: bytes):
        if (
            not self.running
            or not self.connection
            or not audio_bytes
        ):
            return

        try:
            self.connection.send_media(
                audio_bytes
            )

        except Exception as error:
            print(
                f"CALLSHIELD AUDIO SEND ERROR: {error}"
            )

    def stop(self):
        if not self.running:
            return

        self.running = False

        connection = self.connection

        if not connection:
            return

        try:
            connection.send_finalize()
        except Exception:
            pass

        try:
            connection.send_close_stream()
        except Exception:
            pass

        self.connection = None
        self.connected = False