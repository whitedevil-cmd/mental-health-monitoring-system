from __future__ import annotations

import os
from pathlib import Path
import sys

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()


def main() -> None:
    try:
        from backend.tools.supabase_tools import debug_table_schema, get_table_data, insert_row
    except Exception as exc:
        print("=== SUPABASE DEBUG START ===")
        print(
            {
                "error": "Supabase tooling unavailable",
                "details": str(exc),
            }
        )
        return

    environment = os.getenv("ENVIRONMENT", "development").lower()
    test_user_id = os.getenv("SUPABASE_DEBUG_USER_ID")
    if not test_user_id and environment != "production":
        test_user_id = "local-debug-user"
    payload = {
        "dominant_emotion": "agent_test",
    }
    if test_user_id:
        payload["user_id"] = test_user_id

    print("=== SUPABASE DEBUG START ===")

    print("\n[1] Checking table access:")
    print(get_table_data("emotion_logs"))

    print("\n[2] Testing insert:")
    if "user_id" not in payload:
        print({"warning": "SUPABASE_DEBUG_USER_ID is not set; inserts into user-scoped tables may fail in production."})
    insert_result = insert_row("emotion_logs", payload)
    print(insert_result)

    if isinstance(insert_result, dict) and insert_result.get("error"):
        print("\n[3] Debugging schema / payload mismatch:")
        print(debug_table_schema("emotion_logs"))
        return

    print("\n[3] Verifying insert:")
    print(get_table_data("emotion_logs"))


if __name__ == "__main__":
    main()
