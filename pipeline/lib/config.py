"""Settings for the pipeline, read from environment variables or a .env file.

Looks for .env in the repo root and in pipeline/ (both git-ignored).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_PIPELINE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_PIPELINE_DIR.parent / ".env")
load_dotenv(_PIPELINE_DIR / ".env")

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "").strip()

# MusicBrainz requires a descriptive User-Agent with a way to contact the app.
USER_AGENT = os.environ.get(
    "MUSICBRAINZ_USER_AGENT",
    "constellation-prototype/0.1 (https://github.com/lesc1aypool/constellation)",
)
