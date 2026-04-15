#!/usr/bin/env python3
"""
TruePayID Startup & Diagnostic Script
Helps ensure backend and database are ready for transactions
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

async def check_database():
    """Verify database connection and schema"""
    try:
        from app.database.connection import create_tables
        print("✅ Database module imported")
        await create_tables()
        print("✅ Database tables verified")
        return True
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False

async def check_models():
    """Verify all models load properly"""
    try:
        from app.models.models import User, Transaction, TokenizedIntent
        print("✅ Models imported successfully")
        return True
    except Exception as e:
        print(f"❌ Models error: {e}")
        return False

async def check_fraud_scorer():
    """Verify AI fraud scorer is trained and ready"""
    try:
        from app.ai_engine.fraud_scorer import fraud_scorer, FraudFeatures
        print("✅ Fraud scorer loaded")
        
        # Test with sample features
        test_features = FraudFeatures(
            amount=15000,
            trust_score=45,
            tx_frequency_7d=8,
            location_mismatch=True,
            hour_of_day=3,
            fraud_report_count=0,
            receiver_is_new=False,
            amount_is_round=False,
            first_time_receiver=True,
        )
        result = fraud_scorer.score(test_features)
        print(f"   Test score: {result.score}/100 ({result.level})")
        print(f"   Sample reasons: {result.reasons[:2]}")
        return True
    except Exception as e:
        print(f"❌ Fraud scorer error: {e}")
        return False

async def check_auth_service():
    """Verify authentication service"""
    try:
        from app.services.auth_service import auth_service
        print("✅ Auth service ready")
        return True
    except Exception as e:
        print(f"❌ Auth service error: {e}")
        return False

async def check_routers():
    """Verify all routers load"""
    try:
        from app.routers import auth, transactions, dashboard, fraud, admin
        print("✅ All routers loaded")
        print(f"   - Auth endpoints: /api/v1/auth/*")
        print(f"   - Transaction endpoints: /api/v1/transactions/*")
        print(f"   - Dashboard endpoints: /api/v1/user/*")
        print(f"   - Fraud endpoints: /api/v1/fraud/*")
        print(f"   - Admin endpoints: /api/v1/admin/*")
        return True
    except Exception as e:
        print(f"❌ Router error: {e}")
        return False

async def main():
    print("\n" + "="*70)
    print("🔍 TruePayID Backend Diagnostics")
    print("="*70 + "\n")
    
    checks = [
        ("Database", check_database),
        ("Models", check_models),
        ("Fraud Scorer", check_fraud_scorer),
        ("Auth Service", check_auth_service),
        ("Routers", check_routers),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"Checking {name}...")
        try:
            result = await check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} failed: {e}")
            results.append((name, False))
        print()
    
    print("="*70)
    print("Summary:")
    print("="*70)
    
    for name, passed in results:
        status = "✅" if passed else "❌"
        print(f"{status} {name}")
    
    all_passed = all(r[1] for r in results)
    
    print("\n" + "="*70)
    if all_passed:
        print("✅ All checks passed! Backend is ready.")
        print("\n📝 To start the servers:\n")
        print("   Terminal 1 (Backend):")
        print("   $ cd backend && venv\\Scripts\\python -m uvicorn app.main:app --reload --port 8000\n")
        print("   Terminal 2 (Frontend):")
        print("   $ cd frontend && npm run dev\n")
        print("   Then visit: http://localhost:5173")
    else:
        print("❌ Some checks failed. Fix the errors above before starting servers.")
    print("="*70 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
