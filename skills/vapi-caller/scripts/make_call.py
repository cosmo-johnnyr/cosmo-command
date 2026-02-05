#!/usr/bin/env python3
"""
Make outbound calls using Vapi.ai API.
Initiates call, polls for completion, and returns structured results.
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

import requests

VAPI_API_URL = "https://api.vapi.ai"
DEFAULT_ASSISTANT_ID = "2c9b265d-0171-4017-8e95-2a6679ee37ec"
DEFAULT_PHONE_NUMBER = "+17372381022"


def get_api_key() -> str:
    """Get Vapi API key from environment."""
    api_key = os.environ.get("VAPI_API_KEY")
    if not api_key:
        print("Error: VAPI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)
    return api_key


def initiate_call(
    api_key: str,
    to_number: str,
    call_goal: str,
    assistant_id: str = DEFAULT_ASSISTANT_ID,
    from_number: str = DEFAULT_PHONE_NUMBER,
    voice: Optional[str] = None,
) -> dict:
    """Initiate an outbound call via Vapi API."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Clean up phone number format
    to_number = to_number.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not to_number.startswith("+"):
        # Assume US number if no country code
        to_number = "+1" + to_number.lstrip("1")

    payload = {
        "assistantId": assistant_id,
        "phoneNumberId": "8009e237-d79b-4d66-9b6a-8f8c0b37121f",
        "customer": {
            "number": to_number,
        },
        "assistantOverrides": {
            "variableValues": {
                "call_goal": call_goal,
            }
        },
    }

    # Override voice if specified
    if voice:
        payload["assistantOverrides"]["voice"] = {
            "provider": "openai",
            "voiceId": voice,
        }

    response = requests.post(
        f"{VAPI_API_URL}/call",
        headers=headers,
        json=payload,
    )
    response.raise_for_status()
    return response.json()


def get_call_details(api_key: str, call_id: str) -> dict:
    """Get detailed call information including transcript and structured data."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{VAPI_API_URL}/call/{call_id}",
        headers=headers,
    )
    response.raise_for_status()
    return response.json()


def poll_call_completion(
    api_key: str,
    call_id: str,
    timeout_seconds: int = 120,
    poll_interval: int = 5,
) -> dict:
    """Poll for call completion and return final details."""
    print(f"Waiting for call to complete (timeout: {timeout_seconds}s)...")

    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        call_details = get_call_details(api_key, call_id)
        status = call_details.get("status", "unknown")

        if status in ["completed", "failed", "canceled", "voicemail", "busy"]:
            return call_details

        print(f"  Status: {status}... (elapsed: {int(time.time() - start_time)}s)")
        time.sleep(poll_interval)

    # Timeout reached
    print("Warning: Call polling timed out. Returning current state.")
    return get_call_details(api_key, call_id)


def extract_order_summary(transcript: str) -> dict:
    """Extract key order details from transcript for food orders."""
    import re
    
    summary = {
        "items": [],
        "total": None,
        "pickup_time": None,
        "name": None,
        "notes": []
    }
    
    lines = transcript.lower().split('\n')
    
    for line in lines:
        # Look for price/total
        if any(word in line for word in ['total', '$', 'dollar', 'price']):
            # Try to find dollar amounts
            amounts = re.findall(r'\$?(\d+\.?\d*)', line)
            if amounts:
                for amt in amounts:
                    if float(amt) > 5:  # Likely a total, not a small item
                        summary["total"] = f"${amt}"
                        break
        
        # Look for pickup time
        if any(word in line for word in ['pickup', 'pick up', 'ready', 'minute', 'hour']):
            time_match = re.search(r'(\d+)[\s-]?(minute|min|hour)', line)
            if time_match:
                summary["pickup_time"] = f"{time_match.group(1)} {time_match.group(2)}s"
        
        # Look for name
        if 'under' in line and any(word in line for word in ['name', 'johnny', 'cosmo']):
            if 'johnny' in line:
                summary["name"] = "Johnny"
    
    return summary


def format_summary(call_details: dict, goal: str = "") -> str:
    """Format call results into a comprehensive summary."""
    status = call_details.get("status", "unknown")
    duration = call_details.get("duration", 0)
    ended_reason = call_details.get("endedReason", "N/A")
    call_id = call_details.get("id", "N/A")

    summary = []
    summary.append("=" * 60)
    summary.append("📞 VAPI CALL SUMMARY")
    summary.append("=" * 60)
    summary.append(f"Status: {status.upper()}")
    summary.append(f"Call ID: {call_id}")
    summary.append(f"Duration: {duration} seconds")
    summary.append(f"Ended Reason: {ended_reason}")
    summary.append("")

    # Transcript
    transcript = call_details.get("transcript", "")
    if transcript:
        summary.append("-" * 60)
        summary.append("📝 TRANSCRIPT")
        summary.append("-" * 60)
        summary.append(transcript)
        summary.append("")
        
        # Auto-extract order summary for food orders
        if any(word in goal.lower() for word in ['order', 'food', 'restaurant', 'curry', 'pad thai']):
            order_info = extract_order_summary(transcript)
            if order_info["items"] or order_info["total"] or order_info["pickup_time"]:
                summary.append("-" * 60)
                summary.append("🍽️ ORDER SUMMARY (Auto-extracted)")
                summary.append("-" * 60)
                if order_info["items"]:
                    summary.append(f"Items: {', '.join(order_info['items'])}")
                if order_info["total"]:
                    summary.append(f"Total: {order_info['total']}")
                if order_info["pickup_time"]:
                    summary.append(f"Pickup: {order_info['pickup_time']}")
                if order_info["name"]:
                    summary.append(f"Name: {order_info['name']}")
                summary.append("")

    # Analysis/structured output
    analysis = call_details.get("analysis", {})
    if analysis:
        summary.append("-" * 60)
        summary.append("📊 ANALYSIS")
        summary.append("-" * 60)
        summary.append(json.dumps(analysis, indent=2))
        summary.append("")

    # Artifact/structured data
    artifact = call_details.get("artifact", {})
    if artifact:
        summary.append("-" * 60)
        summary.append("📦 STRUCTURED OUTPUT")
        summary.append("-" * 60)
        summary.append(json.dumps(artifact, indent=2))
        summary.append("")

    # Messages (full conversation log)
    messages = call_details.get("messages", [])
    if messages:
        summary.append("-" * 60)
        summary.append("💬 MESSAGES")
        summary.append("-" * 60)
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            summary.append(f"[{role.upper()}]: {content}")
        summary.append("")

    summary.append("=" * 60)

    return "\n".join(summary)


def main():
    parser = argparse.ArgumentParser(description="Make outbound calls via Vapi.ai")
    parser.add_argument("--to", required=True, help="Target phone number")
    parser.add_argument("--goal", required=True, help="Purpose of the call")
    parser.add_argument("--wait", type=int, default=120, help="Seconds to wait for completion")
    parser.add_argument("--assistant-id", default=DEFAULT_ASSISTANT_ID, help="Vapi assistant ID")
    parser.add_argument("--from-number", default=DEFAULT_PHONE_NUMBER, help="Source phone number")
    parser.add_argument("--voice", default=None, help="OpenAI voice to use (alloy, echo, fable, onyx, nova, shimmer, marin)")

    args = parser.parse_args()

    api_key = get_api_key()

    print(f"Initiating call to {args.to}...")
    print(f"Goal: {args.goal}")
    if args.voice:
        print(f"Voice: {args.voice}")
    print()

    try:
        # Initiate call
        call_response = initiate_call(
            api_key=api_key,
            to_number=args.to,
            call_goal=args.goal,
            assistant_id=args.assistant_id,
            from_number=args.from_number,
            voice=args.voice,
        )

        call_id = call_response.get("id")
        print(f"Call initiated! Call ID: {call_id}")
        print()

        # Poll for completion
        call_details = poll_call_completion(api_key, call_id, timeout_seconds=args.wait)

        # Format and print summary
        summary = format_summary(call_details, goal=args.goal)
        print(summary)

        # Also output raw JSON for programmatic use
        print("\n" + "=" * 60)
        print("RAW JSON OUTPUT")
        print("=" * 60)
        print(json.dumps(call_details, indent=2, default=str))

    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}", file=sys.stderr)
        if e.response is not None:
            print(f"Response: {e.response.text}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
