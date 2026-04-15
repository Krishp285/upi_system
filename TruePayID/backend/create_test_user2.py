#!/usr/bin/env python3
"""Create a second test user for quick testing"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database.connection import get_db
from app.models.models import User, TrustScore
from sqlalchemy import select
from app.services.auth_service import _hash_password

async def create_test_user():
    # Get database session
    gen = get_db()
    db = await gen.__anext__()
    
    try:
        # Check if user already exists
        result = await db.execute(
            select(User).where(User.email == "krishkpatelk2005@gmail.com")
        )
        if result.scalar_one_or_none():
            print("❌ User with this email already exists")
            return

        # Create user
        test_user = User(
            upi_id="krishk@upi",
            phone="9876543211",
            email="krishkpatelk2005@gmail.com",
            full_name="Krish Patel",
            password_hash=_hash_password("password123"),
            is_verified=True,
            is_active=True,
        )
        db.add(test_user)
        await db.flush()

        # Create trust score
        db.add(TrustScore(
            user_id=test_user.id,
            trust_score=75,
            fraud_history_level="High"
        ))

        await db.commit()
        print(f"✅ Test user created!")
        print(f"   Email: krishkpatelk2005@gmail.com")
        print(f"   Password: password123")
        print(f"   UPI: krishk@upi")
        
    except Exception as e:
        await db.rollback()
        print(f"❌ Error: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(create_test_user())
