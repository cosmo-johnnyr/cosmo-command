---
name: vapi-caller
description: Make outbound phone calls using Vapi.ai voice assistants. Use when the user needs to initiate a phone call to a specific number with a dynamic goal/purpose. The assistant will handle the conversation, gather information, and return structured results.
---

# Vapi Caller

Make outbound phone calls using your Vapi.ai "Cosmo Voice" assistant.

## Configuration

Set the Vapi private API key as an environment variable:
```bash
export VAPI_API_KEY="3f09b92b-1698-48dc-a512-7bb32ce63e7e"
```

Install Python dependencies:
```bash
pip install -r scripts/requirements.txt
```

**Assistant Details:**
- Assistant ID: `2c9b265d-0171-4017-8e95-2a6679ee37ec`
- Phone Number: `+1 (737) 238 1022`
- Voice: `marin` (OpenAI TTS - natural, phone-friendly)
- Dynamic Variable: `{{call_goal}}` - injected at call time

## Usage

### Making a Call

Use the `make_call.py` script:

```bash
python scripts/make_call.py --to "+15551234567" --goal "scheduling a dentist appointment for Eli"

# With a different voice
python scripts/make_call.py --to "+15551234567" --goal "placing a food order" --voice marin
```

**Parameters:**
- `--to`: Target phone number (E.164 format preferred, e.g., +1-555-123-4567)
- `--goal`: The purpose of the call (injected into {{call_goal}} variable)
- `--wait`: (Optional) Seconds to wait for call completion (default: 120)
- `--voice`: (Optional) Override the voice (e.g., `marin`, `alloy`, `nova`, `shimmer`)

### Getting Results

The script will:
1. Initiate the outbound call
2. Poll for call completion (configurable timeout)
3. Fetch structured outputs from the call via Vapi API
4. Return a comprehensive summary including the full transcript

**Output includes:**
- Call status (completed, failed, voicemail, etc.)
- Full transcript of the conversation
- Structured data captured (from artifact plan)
- Duration and key outcomes

### Post-Call Summary (REQUIRED)

**After ANY call is placed, you MUST:**
1. **Dynamically fetch the call results from Vapi API** using the Call ID returned by the script
2. **Verify the call status** and check for any errors
3. **Present a summary of the results** with key details

For **food orders**, extract and report:
- ✅ Items ordered (with any substitutions)
- 💰 Total price
- ⏰ Pickup/delivery time
- 📛 Name the order is under
- 📝 Any special instructions confirmed

For **appointments**, extract and report:
- 📅 Date and time confirmed
- 📍 Location
- 👤 Who the appointment is for
- 📝 Any preparation instructions

Always present the transcript or key conversation highlights so the user knows what was discussed.

**If the call fails or no output is returned:**
- Use the Vapi API to list recent calls: `GET https://api.vapi.ai/call`
- Check for calls made in the relevant time window
- Report what actually happened (failed calls, multiple calls, etc.)

### Fetching Past Call Details

To retrieve details of a previous call:

```bash
python scripts/fetch_call.py --call-id "019c21e6-xxxxx"
```

This is useful for:
- Reviewing call transcripts after the fact
- Looking up order details from past calls
- Debugging call issues

## Notes

- The Vapi assistant uses GPT-realtime for natural conversation flow
- The assistant speaks first with: "Hello! I'm calling about {{call_goal}}."
- Structured outputs are configured via the artifact plan in your Vapi dashboard
- Voicemail detection is enabled; messages will be left automatically
