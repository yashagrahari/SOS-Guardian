import asyncio
from typing import List

from RealtimeSTT import AudioToTextRecorder
from dotenv import load_dotenv

from sos_core import detect_emergency

load_dotenv()


async def audio_to_text(user_email: str):
    recorder = AudioToTextRecorder(model="small")

    print(f"Monitoring — SOS alerts will go to: {user_email}")
    print("Speak...")

    conversation_buffer: List[str] = []

    while True:
        text = recorder.text()

        if not text or not text.strip():
            continue

        print(f"You said: {text}")
        conversation_buffer.append(text)

        if len(conversation_buffer) > 3:
            conversation_buffer.clear()

        if len(conversation_buffer) == 3:
            result = await detect_emergency(user_email, conversation_buffer)

            print("\nDetection Result:")
            print(result.output)
            if result.email_sent:
                print(f"SOS email sent to {result.recipient}")
            print("-" * 50)


async def main() -> None:
    email = input("Enter your email for SOS alerts: ").strip()
    if not email:
        raise SystemExit("Email is required.")
    await audio_to_text(email)


if __name__ == "__main__":
    asyncio.run(main())
