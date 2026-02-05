#!/usr/bin/env python3
"""
Fetch call details from Vapi.ai API for a given call ID.
Useful for retrieving transcripts and summaries of past calls.
"""

import argparse
import json
import os
import sys

import requests

VAPI_API_URL = "https://api.vapi.ai"


def get_api_key() -> str:
    """Get Vapi API key from environment."""
    api_key = os.environ.get("VAPI_API_KEY")
    if not api_key:
        print("Error: VAPI_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)
    return api_key


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
            amounts = re.findall(r'\$?(\d+\.?\d*)', line)
            if amounts:
                for amt in amounts:
                    if float(amt) > 5:
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


def format_summary(call_details: dict) -> str:
    """Format call results into a comprehensive summary."""
    status = call_details.get("status", "unknown")
    duration = call_details.get("duration", 0)
    ended_reason = call_details.get("endedReason", "N/A")
    call_id = call_details.get("id", "N/A")
    started_at = call_details.get("startedAt", "N/A")

    summary = []
    summary.append("=" * 60)
    summary.append("📞 VAPI CALL DETAILS")
    summary.append("=" * 60)
    summary.append(f"Call ID: {call_id}")
    summary.append(f"Status: {status.upper()}")
    summary.append(f"Started: {started_at}")
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
        
        # Auto-extract order summary
        order_info = extract_order_summary(transcript)
        if order_info["total"] or order_info["pickup_time"]:
            summary.append("-" * 60)
            summary.append("🍽️ ORDER SUMMARY (Auto-extracted)")
            summary.append("-" * 60)
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

    summary.append("=" * 60)

    return "\n".join(summary)


def main():
    parser = argparse.ArgumentParser(description="Fetch Vapi call details by ID")
    parser.add_argument("--call-id", required=True, help="The Vapi call ID")
    parser.add_argument("--json", action="store_true", help="Output raw JSON only")

    args = parser.parse_args()

    api_key = get_api_key()

    print(f"Fetching call details for {args.call_id}...")
    print()

    try:
        call_details = get_call_details(api_key, args.call_id)
        
        if args.json:
            print(json.dumps(call_details, indent=2, default=str))
        else:
            summary = format_summary(call_details)
            print(summary)

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
