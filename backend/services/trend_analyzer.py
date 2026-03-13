"""
Service for analyzing emotion trends over a given period (e.g. 7 days).
"""

from typing import Any
from collections import Counter
from datetime import datetime, timedelta

def analyze_emotion_trends(emotion_logs: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Analyzes a list of emotion logs (expected from the last 7 days) and returns
    calculated insights including stress_level, dominant_pattern, and volatility_score.
    
    Expected log structure for each item:
    {
        "emotion_label": "sadness" | "happiness" | "stress" | "calm" | ...,
        "confidence": 0.85,
        "created_at": datetime object
    }
    """
    if not emotion_logs:
        return {
            "stress_level": "unknown",
            "dominant_pattern": "insufficient data",
            "volatility_score": 0.0
        }

    # Extract all emotion labels
    emotions = [log.get("emotion_label", "").lower() for log in emotion_logs]
    
    # 1. Count sadness and stress frequency
    emotion_counts = Counter(emotions)
    total_logs = len(emotions)
    
    sadness_count = emotion_counts.get("sadness", 0) + emotion_counts.get("sad", 0)
    stress_count = emotion_counts.get("stress", 0) + emotion_counts.get("anxiety", 0)
    
    # Determine Stress Level
    stress_ratio = stress_count / total_logs
    if stress_ratio > 0.5:
        stress_level = "high"
    elif stress_ratio > 0.2:
        stress_level = "moderate"
    else:
        stress_level = "low"

    # 2. Detect dominant pattern (e.g., rising sadness)
    dominant_pattern = "stable"
    if total_logs >= 4:
        # Simple trend check: divide logs into first half and second half
        mid_point = total_logs // 2
        first_half = emotions[:mid_point]
        second_half = emotions[mid_point:]
        
        sad_first = sum(1 for e in first_half if "sad" in e)
        sad_second = sum(1 for e in second_half if "sad" in e)
        
        if sad_second > sad_first + 1:
            dominant_pattern = "increasing sadness"
        elif emotion_counts.most_common(1)[0][0]:
            dominant_pattern = f"mostly {emotion_counts.most_common(1)[0][0]}"

    # 3. Detect emotional instability (volatility)
    # Volatility could be represented by the discrete number of different emotions 
    # normalized by the number of logs + some factor of changes between adjacent logs.
    changes = sum(1 for i in range(1, len(emotions)) if emotions[i] != emotions[i-1])
    # Max changes is len(emotions) - 1. 
    # Let's create a score from 0.0 to 1.0 based on how often it changes.
    volatility_score = round(changes / (total_logs - 1), 2) if total_logs > 1 else 0.0

    return {
        "stress_level": stress_level,
        "dominant_pattern": dominant_pattern,
        "volatility_score": volatility_score
    }
