#!/usr/bin/env python3
"""Create a new verified test user"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database.connection import get_db
from app.models.models import User, TrustScore
from sqlalchemy import select, delete
from app.services.auth_service import _hash_password

async def create_verified_user():
    gen = get_db()
    db = await gen.__anext__()
    
    try:
        # Delete existing test user if exists
        await db.execute(delete(User).where(User.email == "test@truepay.com"))
        await db.flush()
        
        # Create brand new verified user
        test_user = User(
            upi_id="test@truepay",
            phone="9999999999",
            email="test@truepay.com",
            full_name="Test User",
            password_hash=_hash_password("Test@123456"),
            is_verified=True,  # VERIFIED!
            is_active=True,
        )
        db.add(test_user)
        await db.flush()

        # Create trust score
        db.add(TrustScore(
            user_id=test_user.id,
            score=80,
            level="High"
        ))

        await db.commit()
        print(f"✅ NEW Test user created!")
        print(f"   Email: test@truepay.com")
        print(f"   Password: Test@123456")
        print(f"   UPI: test@truepay")
        print(f"   Status: VERIFIED ✓")
        
    except Exception as e:
        await db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(create_verified_user())
