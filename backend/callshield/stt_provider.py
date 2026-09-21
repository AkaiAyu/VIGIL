from abc import ABC, abstractmethod


class STTProvider(ABC):
    """
    Common interface for CallShield speech-to-text providers.
    """

    @abstractmethod
    def start(self):
        """
        Start the STT session.
        """
        raise NotImplementedError

    @abstractmethod
    def send_audio(self, audio_bytes: bytes):
        """
        Send raw PCM audio to the STT provider.
        """
        raise NotImplementedError

    @abstractmethod
    def stop(self):
        """
        Stop the STT session.
        """
        raise NotImplementedError

    @abstractmethod
    def set_transcript_callback(self, callback):
        """
        Register a callback for transcript updates.
        """
        raise NotImplementedError