#!/usr/bin/env python3
"""Create a test user with a transaction PIN for testing token decisions."""

import asyncio
import sys
sys.path.insert(0, 'c:\\Users\\DELL\\Downloads\\TruePayID\\TruePayID\\backend')

from app.database.connection import AsyncSessionLocal
from app.models.models import User, TrustScore
from app.services.auth_service import _hash_password, _hash_pin

async def create_test_user_with_pin():
    """Create a verified test user with PIN for token testing."""
    async with AsyncSessionLocal() as session:
        try:
            # Create user with PIN
            user = User(
                upi_id="test@truepay",
                phone="9999999999",
                email="test@truepay.com",
                full_name="Test User",
                password_hash=_hash_password("Test@123456"),
                transaction_pin_hash=_hash_pin("123456"),  # PIN: 123456
                is_verified=True,
                is_active=True,
            )
            session.add(user)
            await session.flush()
            
            # Create trust score
            trust_score = TrustScore(user_id=user.id, score=75, level="High")
            session.add(trust_score)
            
            await session.commit()
            print(f"✅ Test user created with PIN!")
            print(f"   Email: test@truepay.com")
            print(f"   Password: Test@123456")
            print(f"   UPI: test@truepay")
            print(f"   Transaction PIN: 123456  ← USE THIS FOR TOKEN DECISIONS")
            print(f"   Status: VERIFIED ✓")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_user_with_pin())
