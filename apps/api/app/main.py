import os
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuditLog, User
from .security import current_user, require_role


app = FastAPI(title="TimeLogic API", version="0.1.0")


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code, content={"code": str(exc.status_code), "message": str(exc.detail), "fields": {}}
    )


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    fields = {".".join(map(str, error["loc"])): error["msg"] for error in exc.errors()}
    return JSONResponse(
        status_code=422, content={"code": "422", "message": "Sprawdź dane formularza", "fields": fields}
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    origin = request.headers.get("origin")
    allowed = os.getenv("PUBLIC_ORIGIN", "http://localhost:8080")
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin and origin != allowed:
        return JSONResponse(
            status_code=403, content={"code": "origin", "message": "Niedozwolone pochodzenie", "fields": {}}
        )
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


def audit(db: Session, user: User, action: str, target_type: str, target_id: UUID | None, detail=None):
    db.add(
        AuditLog(
            organization_id=user.organization_id,
            actor_id=user.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=detail or {},
        )
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.scalar(select(func.now()))
    return {"status": "ok"}


@app.get("/api/v1/audit-logs")
def audit_logs(limit: int = 50, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    rows = db.scalars(
        select(AuditLog)
        .where(AuditLog.organization_id == user.organization_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(max(1, min(limit, 100)))
    ).all()
    return [
        {
            "id": str(row.id),
            "action": row.action,
            "target_type": row.target_type,
            "target_id": str(row.target_id) if row.target_id else None,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


from . import auth, catalog, documents, employees, leave, rcp, shifts  # noqa: E402

app.include_router(auth.router, prefix="/api/v1")
app.include_router(catalog.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(rcp.router, prefix="/api/v1")
app.include_router(shifts.router, prefix="/api/v1")
app.include_router(leave.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
