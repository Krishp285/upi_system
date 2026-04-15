#!/usr/bin/env python3
"""Create a test user for demonstration."""

import asyncio
import sys
sys.path.insert(0, 'c:\\Users\\DELL\\Downloads\\TruePayID\\TruePayID\\backend')

from app.database.connection import AsyncSessionLocal
from app.models.models import User, TrustScore
from app.services.auth_service import _hash_password

async def create_test_user():
    """Create a verified test user."""
    async with AsyncSessionLocal() as session:
        try:
            # Create user
            user = User(
                upi_id="demo@bank",
                phone="9876543210",
                email="demo@example.com",
                full_name="Demo User",
                password_hash=_hash_password("password123"),
                is_verified=True,  # Mark as verified
                is_active=True,
            )
            session.add(user)
            await session.flush()
            
            # Create trust score
            trust_score = TrustScore(user_id=user.id, score=75, level="High")
            session.add(trust_score)
            
            await session.commit()
            print(f"✅ Test user created!")
            print(f"   UPI: demo@bank")
            print(f"   Phone: 9876543210")
            print(f"   Email: demo@example.com")
            print(f"   Password: password123")
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(create_test_user())
