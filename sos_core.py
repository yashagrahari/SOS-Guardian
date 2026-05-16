import os
from typing import List

import resend
from agents import Agent, Runner, function_tool
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class DetectionResult(BaseModel):
    output: str
    email_sent: bool
    recipient: str


def _make_send_email(user_email: str, sent_flag: dict[str, bool]):
    @function_tool
    def send_email(subject: str, body: str) -> str:
        """Send an SOS email to the logged-in user with the given subject and body."""
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            return "Error: RESEND_API_KEY is not configured."

        resend.api_key = api_key
        resend.Emails.send(
            {
                "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
                "to": user_email,
                "subject": subject,
                "html": f"<p>{body}</p>",
            }
        )
        sent_flag["sent"] = True
        return f"SOS email sent to {user_email}."

    return send_email


async def detect_emergency(user_email: str, conversation: List[str]) -> DetectionResult:
    """Detect emergency situations and alert the logged-in user by email."""
    sent_flag: dict[str, bool] = {"sent": False}
    send_email = _make_send_email(user_email, sent_flag)

    agent = Agent(
        name="SOS Agent",
        instructions=(
            "You are a helpful SOS bot that continuously listens to conversations "
            "and detects emergencies (medical distress, danger, fire, assault, "
            "accidents, someone asking for help, etc.). "
            f"When you detect a genuine emergency, call send_email with subject 'SOS' "
            f"and a brief HTML-safe summary of the incident. "
            f"Emails must only go to the logged-in user: {user_email}. "
            "If there is no emergency, explain briefly that monitoring continues "
            "and do not send email."
        ),
        model="gpt-5.5",
        tools=[send_email],
    )

    result = await Runner.run(agent, "\n".join(conversation))

    return DetectionResult(
        output=str(result.final_output),
        email_sent=sent_flag["sent"],
        recipient=user_email,
    )
