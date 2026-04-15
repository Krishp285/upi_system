# backend/app/main.py
# TruePayID FastAPI Application Entry Point
# Registers all routers, middleware, startup hooks

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.config import get_settings
from app.database.connection import create_tables
from app.routers import auth, transactions, dashboard, fraud, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup: create DB tables, warm up AI model.
    The fraud scorer is imported as a module-level singleton,
    so it trains/loads on first import.
    """
    logger.info("Starting TruePayID backend...")
    try:
        await create_tables()
    except Exception as e:
        logger.error("Database connection failed:", exc_info=True)

    # Import fraud scorer here to trigger training on startup
    from app.ai_engine.fraud_scorer import fraud_scorer  # noqa: F401
    logger.info(f"AI Fraud Scorer ready | {settings.APP_NAME} v{settings.APP_VERSION}")

    yield
    logger.info("Shutting down TruePayID backend...")


app = FastAPI(
    title="TruePayID API",
    description="Trust, Intelligence & Fraud Prevention Layer for UPI Payments",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    import sys
    error_detail = f"Unhandled exception: {type(exc).__name__}: {exc}"
    logger.error(error_detail, exc_info=True)
    print(f"\n>>> ERROR: {error_detail}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again later."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors.
    Logs detailed field-level error information for debugging.
    """
    import sys
    errors = exc.errors()
    logger.error(f"Validation error on {request.method} {request.url.path}")
    for error in errors:
        field = ".".join(str(x) for x in error["loc"][1:])  # Skip "body" in loc
        msg = error["msg"]
        logger.error(f"  {field}: {msg}")
        print(f">>> VALIDATION ERROR {field}: {msg}", file=sys.stderr)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": [
                {
                    "loc": list(error["loc"]),
                    "msg": error["msg"],
                    "type": error["type"]
                }
                for error in errors
            ]
        },
    )

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(dashboard.router,    prefix="/api/v1")
app.include_router(fraud.router,        prefix="/api/v1")
app.include_router(admin.router)  # Admin has its own prefix


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.post("/api/v1/auth/login-test")
async def login_test(request: Request):
    """Debug endpoint to test request handling"""
    try:
        body = await request.json()
        logger.info(f"TEST ENDPOINT - Received login request: {body}")
        return {"status": "received", "body": body}
    except Exception as e:
        logger.error(f"TEST ENDPOINT - Error: {e}", exc_info=True)
        raise
