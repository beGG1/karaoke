import whisper
import json
import sys
from pathlib import Path

# Change this if needed
INPUT_FILE = "vocals.wav"
OUTPUT_FILE = "lyrics.json"

def transcribe(file_path, output_path):
    print(f"Loading Whisper model...")
    model = whisper.load_model("medium")  # Or "base", "small", "large"

    print(f"Transcribing: {file_path}")
    result = model.transcribe(file_path)

    # Extract only useful segments (start, end, text)
    output = [
        {
            "start": round(seg["start"], 2),
            "end": round(seg["end"], 2),
            "text": seg["text"].strip()
        }
        for seg in result["segments"]
    ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Done. Output saved to {output_path}")

if __name__ == "__main__":
    input_path = sys.argv[1] if len(sys.argv) > 1 else INPUT_FILE
    output_path = sys.argv[2] if len(sys.argv) > 2 else OUTPUT_FILE

    if not Path(input_path).exists():
        print(f"File not found: {input_path}")
        sys.exit(1)

    transcribe(input_path, output_path)
