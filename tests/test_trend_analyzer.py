import pytest
from datetime import datetime, timedelta
from backend.services.trend_analyzer import analyze_emotion_trends

def create_synthetic_logs(labels: list[str]) -> list[dict]:
    """Helper to create fake log entries for testing."""
    base_time = datetime.now()
    return [
        {
            "emotion_label": label,
            "confidence": 0.9,
            "created_at": base_time + timedelta(hours=i)
        }
        for i, label in enumerate(labels)
    ]

def test_analyze_emotion_trends_empty_input():
    result = analyze_emotion_trends([])
    assert result["stress_level"] == "unknown"
    assert result["dominant_pattern"] == "insufficient data"
    assert result["volatility_score"] == 0.0

def test_stress_level_calculation_low():
    logs = create_synthetic_logs(["calm", "happy", "happy", "neutral", "calm"])
    result = analyze_emotion_trends(logs)
    assert result["stress_level"] == "low"

def test_stress_level_calculation_moderate():
    # 2 stress out of 5 = 0.4 (> 0.2 and <= 0.5)
    logs = create_synthetic_logs(["stress", "happy", "anxiety", "neutral", "calm"])
    result = analyze_emotion_trends(logs)
    assert result["stress_level"] == "moderate"

def test_stress_level_calculation_high():
    # 4 stress out of 5 = 0.8 (> 0.5)
    logs = create_synthetic_logs(["stress", "anxiety", "stress", "neutral", "stress"])
    result = analyze_emotion_trends(logs)
    assert result["stress_level"] == "high"

def test_detection_of_increasing_sadness():
    # First half has 1 sad, second half has 3 sad (which > 1 + 1)
    # Total 6: first half [sad, neutral, calm], second half [sad, sad, sad]
    logs = create_synthetic_logs(["sad", "neutral", "calm", "sad", "sad", "sad"])
    result = analyze_emotion_trends(logs)
    assert "increasing sadness" in result["dominant_pattern"].lower()

def test_no_increasing_sadness():
    # First half has 2 sad, second half has 1 sad
    logs = create_synthetic_logs(["sad", "sad", "calm", "sad", "happy", "happy"])
    result = analyze_emotion_trends(logs)
    assert "increasing sadness" not in result["dominant_pattern"].lower()
    assert result["dominant_pattern"] == "mostly sad"

def test_volatility_score_range_and_correctness():
    # Constant emotion: 0 changes => 0.0
    logs_stable = create_synthetic_logs(["calm", "calm", "calm", "calm"])
    result_stable = analyze_emotion_trends(logs_stable)
    assert result_stable["volatility_score"] == 0.0

    # Changing every time: 4 changes out of 4 possible => 1.0
    logs_volatile = create_synthetic_logs(["calm", "angry", "sad", "happy", "neutral"])
    result_volatile = analyze_emotion_trends(logs_volatile)
    assert result_volatile["volatility_score"] == 1.0

    # Mixed changes: 2 changes out of 4 possible => 0.5
    logs_mixed = create_synthetic_logs(["sad", "sad", "neutral", "sad", "sad"])
    result_mixed = analyze_emotion_trends(logs_mixed)
    # changes: sad->sad (0), sad->neutral (1), neutral->sad (1), sad->sad (0) = 2 changes. Total pairs = 4. 2 / 4 = 0.5
    assert result_mixed["volatility_score"] == 0.5

def test_user_provided_example():
    # ["sad","sad","neutral","sad","angry"]
    logs = create_synthetic_logs(["sad", "sad", "neutral", "sad", "angry"])
    result = analyze_emotion_trends(logs)
    
    # Stress level: no "stress" or "anxiety" => low
    assert result["stress_level"] == "low"
    
    # Trend: 5 logs. First half [sad, sad]. Second half [neutral, sad, angry].
    # Sad in first = 2. Sad in second = 1. Not increasing sadness. 
    # Most common = sad (3 times)
    assert result["dominant_pattern"] == "mostly sad"
    
    # Volatility: sad->sad (0), sad->neutral (1), neutral->sad (1), sad->angry (1)
    # Changes = 3. Possible = 4. Score = 0.75
    assert result["volatility_score"] == 0.75
