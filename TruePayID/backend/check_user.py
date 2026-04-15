#!/usr/bin/env python3
"""Debug user account status"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database.connection import get_db
from app.models.models import User
from sqlalchemy import select
from app.services.auth_service import _verify_password

async def check_user():
    gen = get_db()
    db = await gen.__anext__()
    
    try:
        result = await db.execute(
            select(User).where(User.email == "krishkpatelk2005@gmail.com")
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print("❌ User not found")
            return
            
        print(f"✅ User found: {user.full_name}")
        print(f"   Email: {user.email}")
        print(f"   UPI: {user.upi_id}")
        print(f"   Phone: {user.phone}")
        print(f"   Verified: {user.is_verified}")
        print(f"   Active: {user.is_active}")
        print(f"   Password Hash: {user.password_hash[:30]}...")
        
        # Test password verification
        test_password = "password123"
        is_valid = _verify_password(test_password, user.password_hash)
        print(f"   Password '{test_password}' valid: {is_valid}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_user())
