#!/usr/bin/env python3
"""Direct test of auth service to find the error"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.database.connection import AsyncSessionLocal, create_tables
from app.services.auth_service import auth_service
from app.schemas.schemas import LoginRequest

async def main():
    # Initialize database
    print("Initialating database...")
    await create_tables()
    
    # Create session
    async with AsyncSessionLocal() as db:
        # Test login
        print("Testing login...")
        login_req = LoginRequest(identifier='test@truepay.com', password='Test@123456')
        try:
            result = await auth_service.login(db, login_req)
            print(f"Success: {result}")
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
