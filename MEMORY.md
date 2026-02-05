# MEMORY.md - Long-Term Memory

## User Information
- **Name:** Johnny Rodriguez
- **Age and Birthday:** Currently 37 years old. July 16, 1988
- **Location:** Pflugerville, TX (Central Time)
- **Local Time:** CST
- **Dog:** Floki (100 lb Goldendoodle), cats Rosa and Azul
- **Cats:** Rosa and Azul, both are overweight tabby cats
- **Religion:** The family are all members of the Church of Jesus Christ of Latter-day Saints.
- **Job & Role:** Johnny works at Fresh Consulting, out of Bellevue Washington, but lives in Texas. He's been at Fresh since 2014. Currently, Johnny is the Chief Innovation Officer.

## Family
- **Alyssa** — Wife, born January 24, 1992. Married August 24, 2012.
- **Fina** — Eldest daughter, born January 07, 2017. She's half black and white. Born in Detroit, Michigan. She was adopted at birth. Full name is Fallon Josefina Rodriguez, but goes by Fina. Has ADHD. She's currently in 3rd grade and goes to Riojas Elementary.
- **Eli** — Eldest Son, born February 3, 2017. Wants to be a mechatronic engineer or robotics engineer. Loves building things, technology, taking things apart, puzzles. Has ADHD. He has autism, but people don't really know this because he is social and seems normal. Love CrunchLabs builds. He's currently in 2nd grade and goes to Riojas Elementary.
- **Arlie** — Youngest child, born October 24, 2018. Loves Fortnite and other video games. Very athletic. Ahead at school right now and can already read. He's currently in 1st grade and goes to Riojas Elementary.


## Session Memory Search Status
- OpenAI API key configured for embeddings (2026-02-01)
- Session memory search enabled with sources: memory + sessions
- **Issue:** Session transcripts not yet populating in search results

## Morning Briefing
- **Cron Job ID:** `5b2bdb1c-3609-42d2-97a4-7b94ca935a70`
- **Schedule:** Daily at 7:00 AM CST (America/Chicago)
- **Template:** `MorningBriefing.md` in workspace root
- **Sections:** Weather (Pflugerville), Top Gen AI News, Trending OpenClaw on X
- **Architecture:** `sessionTarget: isolated` + `agentTurn` with `deliver: true` + `channel: last` — Spawns sub-agent that sends briefing directly to user's last active channel
- **On-demand triggers:** "execute MorningBriefing.md" or "give me a current briefing"

## PULSE Heartbeat System
- **Cron Job ID:** `7add602e-ff27-45bd-99ec-ed690c3cd94b`
- **Schedule:** Every 30 minutes
- **Message Format:** `🫀🥁: <<contextual message>>`
- **Template:** `PULSE.md` in workspace root
- **Architecture:** `sessionTarget: isolated` + `agentTurn` with `deliver: true` + `channel: last` — Spawns sub-agent that sends message directly to user's last active channel
- **Goal:** Connection and value-add through contextual, time-appropriate messaging
- **Response Tracking:** Adjusts based on whether previous heartbeat received response
- **Time-Aware Contexts:**
  - Late Night (11 PM - 7 AM): Dream-focused, reflective
  - Early Morning (7 AM - 9 AM): Warm greetings, day preparation
  - Work Hours (9 AM - 6 PM): Productivity, stress relief, help offers
  - Evening (6 PM - 11 PM): Family, reflection, wind-down
  - Sunday: Spiritual, reverent themes, LDS-themed quotes maybe, Book of Mormon References.

## Notes
*Add significant events, lessons, and context worth remembering here.*
