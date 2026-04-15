#!/usr/bin/env python3
"""Update test user with transaction PIN."""

import asyncio
import sys
sys.path.insert(0, 'c:\\Users\\DELL\\Downloads\\TruePayID\\TruePayID\\backend')

from app.database.connection import AsyncSessionLocal
from app.models.models import User
from app.services.auth_service import _hash_pin
from sqlalchemy import select

async def update_user_with_pin():
    """Update test user with transaction PIN (4 digits)."""
    async with AsyncSessionLocal() as session:
        try:
            # Find existing test user
            result = await session.execute(
                select(User).where(User.email == "test@truepay.com")
            )
            user = result.scalar_one()
            
            # Update with 4-digit PIN
            user.transaction_pin_hash = _hash_pin("1234")
            await session.commit()
            
            print(f"✅ Test user updated with PIN!")
            print(f"   Email: {user.email}")
            print(f"   UPI: {user.upi_id}")
            print(f"   Transaction PIN: 1234  ← USE THIS FOR ALL TRANSACTIONS")
            print(f"\n🔑 When prompted for PIN, enter: 1234")
            print(f"\n📋 Use this PIN for:")
            print(f"   • High-risk transaction approval (after initial PIN entry)")
            print(f"   • Token approval/denial from Pending Tokens page")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(update_user_with_pin())
