class PCMRecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.buffer = [];
        this.sampleCount = 0;

        this.port.onmessage = (event) => {
            if (event.data === "reset") {
                this.buffer = [];
                this.sampleCount = 0;
            }
        };
    }

    process(inputs) {
        const input = inputs[0];

        if (!input || !input[0]) {
            return true;
        }

        const channel = input[0];

        this.buffer.push(new Float32Array(channel));
        this.sampleCount += channel.length;

        // Send approximately every 4 seconds.
        const targetSamples = sampleRate * 4;

        if (this.sampleCount >= targetSamples) {
            const samplesToSend =
                this.buffer.reduce(
                    (total, chunk) =>
                        total + chunk.length,
                    0
                );

            const combined =
                new Float32Array(samplesToSend);

            let offset = 0;

            for (const chunk of this.buffer) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            const fourSecondSamples =
                combined.slice(0, targetSamples);

            this.port.postMessage(
                {
                    type: "audio",
                    samples: fourSecondSamples,
                    sampleRate,
                },
                [fourSecondSamples.buffer]
            );

            // Preserve anything beyond 4 seconds
            const remaining =
                combined.slice(targetSamples);

            this.buffer =
                remaining.length > 0
                    ? [remaining]
                    : [];

            this.sampleCount =
                remaining.length;
        }

        return true;
    }
}

registerProcessor(
    "pcm-recorder-processor",
    PCMRecorderProcessor
);