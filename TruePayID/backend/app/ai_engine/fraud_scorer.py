# backend/app/ai_engine/fraud_scorer.py
# AI-powered fraud risk scoring engine
# Uses Logistic Regression trained on synthetic but realistic UPI fraud patterns
# This is the core intelligence layer of TruePayID

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import joblib
import os
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.pkl")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.pkl")


@dataclass
class FraudFeatures:
    """
    Feature vector for risk scoring.
    All features are normalized before model input.
    """
    amount:               float   # Transaction amount in INR
    trust_score:          int     # Receiver trust score (0–100)
    tx_frequency_7d:      int     # Sender's txn count last 7 days
    location_mismatch:    bool    # True if receiver's usual city differs from current
    hour_of_day:          int     # 0–23 (night txns = higher risk)
    fraud_report_count:   int     # Reports against receiver
    receiver_is_new:      bool    # Receiver registered < 30 days ago
    amount_is_round:      bool    # Round amounts (1000, 5000) — common in fraud
    first_time_receiver:  bool    # Sender has never sent to this receiver before


@dataclass
class RiskResult:
    score:             int
    level:             str
    reasons:           list[str]
    location_mismatch: bool
    requires_token:    bool
    feature_snapshot:  dict


class FraudScorer:
    """
    Singleton fraud scoring engine.
    Trains on startup if no saved model exists.
    In production, replace with a periodically retrained model
    fed from real transaction outcome data.
    """

    def __init__(self):
        self.model: Optional[LogisticRegression] = None
        self.scaler: Optional[StandardScaler] = None
        self._load_or_train()

    def _generate_training_data(self):
        """
        Generate synthetic training data reflecting known UPI fraud patterns:
        - Large round-number transactions to unknown receivers → high risk
        - Late-night transactions with location mismatch → elevated risk
        - High-trust, well-known receiver → low risk
        """
        np.random.seed(42)
        n = 2000

        # Safe transactions (label=0): moderate amounts, known receiver, daytime
        safe_amounts     = np.random.uniform(100, 5000, n // 2)
        safe_trust       = np.random.randint(60, 100, n // 2)
        safe_freq        = np.random.randint(1, 30, n // 2)
        safe_loc_mis     = np.random.choice([0, 1], n // 2, p=[0.9, 0.1])
        safe_hour        = np.random.randint(8, 22, n // 2)
        safe_reports     = np.zeros(n // 2)
        safe_new_recv    = np.random.choice([0, 1], n // 2, p=[0.85, 0.15])
        safe_round       = np.random.choice([0, 1], n // 2, p=[0.7, 0.3])
        safe_first_time  = np.random.choice([0, 1], n // 2, p=[0.6, 0.4])

        # Fraud transactions (label=1): large amounts, low trust, night, mismatch
        fraud_amounts    = np.random.uniform(5000, 100000, n // 2)
        fraud_trust      = np.random.randint(0, 40, n // 2)
        fraud_freq       = np.random.randint(0, 5, n // 2)
        fraud_loc_mis    = np.random.choice([0, 1], n // 2, p=[0.3, 0.7])
        fraud_hour       = np.random.choice(
            list(range(0, 6)) + list(range(22, 24)), n // 2
        )
        fraud_reports    = np.random.randint(1, 10, n // 2)
        fraud_new_recv   = np.random.choice([0, 1], n // 2, p=[0.2, 0.8])
        fraud_round      = np.random.choice([0, 1], n // 2, p=[0.3, 0.7])
        fraud_first_time = np.ones(n // 2)

        X = np.vstack([
            np.column_stack([safe_amounts, safe_trust, safe_freq, safe_loc_mis,
                             safe_hour, safe_reports, safe_new_recv, safe_round, safe_first_time]),
            np.column_stack([fraud_amounts, fraud_trust, fraud_freq, fraud_loc_mis,
                             fraud_hour, fraud_reports, fraud_new_recv, fraud_round, fraud_first_time])
        ])
        y = np.array([0] * (n // 2) + [1] * (n // 2))
        return X, y

    def _load_or_train(self):
        """Load persisted model or train a new one."""
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            try:
                self.model  = joblib.load(MODEL_PATH)
                self.scaler = joblib.load(SCALER_PATH)
                logger.info("Fraud model loaded from disk")
                return
            except Exception as e:
                logger.warning(f"Could not load model: {e} — retraining")

        logger.info("Training fraud detection model...")
        X, y = self._generate_training_data()

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = LogisticRegression(
            C=1.0,
            max_iter=500,
            class_weight="balanced",  # Crucial: fraud is rare → balance classes
            random_state=42,
        )
        self.model.fit(X_scaled, y)

        # Persist to disk
        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        logger.info("Fraud model trained and saved")

    def score(self, features: FraudFeatures, high_value_threshold: float = 10000.0) -> RiskResult:
        """
        Score a transaction and return risk level + human-readable reasons.
        Score is calibrated to 0–100 range.
        """
        feature_vec = np.array([[
            features.amount,
            features.trust_score,
            features.tx_frequency_7d,
            int(features.location_mismatch),
            features.hour_of_day,
            features.fraud_report_count,
            int(features.receiver_is_new),
            int(features.amount_is_round),
            int(features.first_time_receiver),
        ]])

        X_scaled = self.scaler.transform(feature_vec)
        # probability of fraud class
        fraud_prob = self.model.predict_proba(X_scaled)[0][1]

        # Map 0.0–1.0 probability to 0–100 risk score
        raw_score = int(fraud_prob * 100)

        # Rule-based boosters on top of ML score (explainability)
        reasons: list[str] = []
        boost = 0

        if features.location_mismatch:
            boost += 10
            reasons.append("Location mismatch detected — receiver active in different city")

        if features.fraud_report_count > 0:
            boost += min(features.fraud_report_count * 5, 25)
            reasons.append(f"Receiver has {features.fraud_report_count} fraud report(s)")

        if features.trust_score < 30:
            boost += 8
            reasons.append(f"Low receiver trust score ({features.trust_score}/100)")

        if features.receiver_is_new:
            boost += 7
            reasons.append("Receiver account is newly registered")

        if features.amount > high_value_threshold:
            boost += 5
            reasons.append(f"High-value transaction (₹{features.amount:,.0f})")

        if features.hour_of_day in list(range(0, 6)) + [22, 23]:
            boost += 8
            reasons.append("Transaction initiated during unusual hours (late night)")

        if features.amount_is_round and features.amount >= 1000:
            boost += 3
            reasons.append("Round-number amount (common pattern in social-engineering fraud)")

        if features.first_time_receiver:
            boost += 4
            reasons.append("First transaction to this receiver")

        score = min(raw_score + boost, 100)

        # Determine level
        if score >= 90:
            level = "Critical"
        elif score >= 70:
            level = "High"
        elif score >= 40:
            level = "Medium"
        else:
            level = "Low"
            if not reasons:
                reasons.append("No significant risk factors detected")

        # Token required for ALL transactions (security requirement)
        requires_token = True

        feature_snapshot = {
            "amount": features.amount,
            "trust_score": features.trust_score,
            "tx_frequency_7d": features.tx_frequency_7d,
            "location_mismatch": features.location_mismatch,
            "hour_of_day": features.hour_of_day,
            "fraud_report_count": features.fraud_report_count,
            "receiver_is_new": features.receiver_is_new,
            "amount_is_round": features.amount_is_round,
            "first_time_receiver": features.first_time_receiver,
            "fraud_probability": round(float(fraud_prob), 4),
        }

        return RiskResult(
            score=score,
            level=level,
            reasons=reasons,
            location_mismatch=features.location_mismatch,
            requires_token=requires_token,
            feature_snapshot=feature_snapshot,
        )


# Module-level singleton — instantiated once on import
fraud_scorer = FraudScorer()
