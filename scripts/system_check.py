import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests library not found. Please 'pip install requests' first.")
    sys.exit(1)

BASE_URL = "http://localhost:8000"

def check():
    print("1. Checking backend server reachable & health endpoint responds...")
    try:
        r = requests.get(f"{BASE_URL}/health")
        r.raise_for_status()
        print(" -> OK")
    except Exception as e:
        print(f" -> ERROR: backend server unreachable or health check failed: {e}")
        raise

    print("2. Checking upload endpoint works...")
    # Create a 2.5-second sine wave to bypass librosa.trim and duration < 2.0 checks
    import wave
    import math
    import struct
    
    test_file = Path("test_check.wav")
    try:
        sample_rate = 16000
        duration = 2.5
        frequency = 440.0 # A4 tone
        
        with wave.open(str(test_file), 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            
            for i in range(int(sample_rate * duration)):
                value = int(32767.0 * math.sin(2.0 * math.pi * frequency * i / sample_rate))
                wav_file.writeframesraw(struct.pack('<h', value))
            
        with open(test_file, "rb") as f:
            files = {"file": ("test_check.wav", f, "audio/wav")}
            r = requests.post(f"{BASE_URL}/upload-audio", files=files)
            r.raise_for_status()
            data = r.json()
            file_path = data.get("file_path")
            print(" -> OK")
    except Exception as e:
        print(f" -> ERROR: upload failed: {e}")
        if test_file.exists():
            test_file.unlink()
        raise

    print("3. Checking emotion detection works...")
    try:
        r = requests.post(f"{BASE_URL}/detect-emotion", json={"audio_path": file_path})
        r.raise_for_status()
        print(" -> OK")
    except Exception as e:
        print(f" -> ERROR: emotion detection failed: {e}")
        if test_file.exists():
            test_file.unlink()
        raise

    print("4. Checking trend API returns valid response...")
    try:
        r = requests.get(f"{BASE_URL}/api/v1/insights/emotion-trend?user_id=system_check_user")
        r.raise_for_status()
        print(" -> OK")
    except Exception as e:
        print(f" -> ERROR: trend api failed: {e}")
        if test_file.exists():
            test_file.unlink()
        raise

    if test_file.exists():
        test_file.unlink()
        
    print("\nSYSTEM STATUS: OK")

if __name__ == "__main__":
    try:
        check()
    except Exception:
        print("\nSYSTEM STATUS: FAILED")
        sys.exit(1)
