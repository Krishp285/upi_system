#!/usr/bin/env python3
"""Initialize database schema."""

import asyncio
import sys
sys.path.insert(0, '/Users/DELL/Downloads/TruePayID/TruePayID/backend')

from app.database.connection import engine, Base
from app.models.models import *  # Import all models so Base knows about them
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

async def init_db():
    """Drop all tables and recreate them."""
    async with engine.begin() as conn:
        print("Disabling foreign key checks...")
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        print("Dropping all existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Re-enabling foreign key checks...")
        await conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        print("Creating all tables from ORM models...")
        await conn.run_sync(Base.metadata.create_all)
        print("Database initialized successfully!")

async def add_missing_columns():
    """Add missing columns if they don't exist."""
    async with AsyncSession(engine) as session:
        # Check and add is_verified column
        try:
            result = await session.execute(
                text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE")
            )
            print("Added is_verified column")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("is_verified column already exists")
            else:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    print("Initializing TruePayID database...")
    asyncio.run(init_db())
    asyncio.run(add_missing_columns())
