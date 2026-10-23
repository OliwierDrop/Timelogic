"""Katalog tagów i stanowisk."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Employee, EmployeeTag, Position, Tag, User
from .security import current_user, require_role, role_codes


router = APIRouter(tags=["Katalog"])


def audit(db: Session, user: User, action: str, kind: str, target: UUID | None, detail=None):
    from .main import audit as write_audit

    write_audit(db, user, action, kind, target, detail)


TAG_COLORS = (
    "#94A3B8",
    "#64748B",
    "#475569",
    "#334155",
    "#1E293B",
    "#0F172A",
    "#7DD3FC",
    "#38BDF8",
    "#0EA5E9",
    "#0284C7",
    "#0369A1",
    "#FCA5A5",
    "#F87171",
    "#EF4444",
    "#DC2626",
    "#B91C1C",
    "#7F1D1D",
    "#86EFAC",
    "#4ADE80",
    "#22C55E",
    "#16A34A",
    "#FDE047",
    "#FACC15",
    "#EAB308",
    "#FB923C",
    "#F97316",
    "#C084FC",
    "#A855F7",
    "#9333EA",
    "#F9A8D4",
    "#EC4899",
    "#DB2777",
)
DEFAULT_TAG_COLOR = TAG_COLORS[0]


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default=DEFAULT_TAG_COLOR, max_length=7)
    is_informational: bool = False


class TagPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=7)
    is_informational: bool | None = None


class PositionIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def resolve_position(
    db: Session,
    user: User,
    *,
    position_id: UUID | None = None,
    position: str | None = None,
    create_missing: bool = False,
) -> tuple[UUID | None, str | None]:
    if position_id is not None:
        row = db.scalar(
            select(Position).where(Position.id == position_id, Position.organization_id == user.organization_id)
        )
        if not row:
            raise HTTPException(422, "Nieprawidłowe stanowisko")
        return row.id, row.name
    if position is not None:
        name = position.strip()
        if not name:
            return None, None
        existing = db.scalar(
            select(Position).where(Position.organization_id == user.organization_id, Position.name == name)
        )
        if existing:
            return existing.id, existing.name
        if not create_missing:
            raise HTTPException(422, "Nieprawidłowe stanowisko")
        row = Position(organization_id=user.organization_id, name=name)
        db.add(row)
        db.flush()
        return row.id, row.name
    return None, None


def apply_position_fields(db: Session, user: User, values: dict, *, create_missing: bool) -> dict:
    if "position_id" not in values and "position" not in values:
        return values
    position_id = values.pop("position_id", None)
    position = values.pop("position", None)
    if position_id is None and position is None:
        values["position_id"] = None
        values["position"] = None
        return values
    resolved_id, resolved_name = resolve_position(
        db, user, position_id=position_id, position=position, create_missing=create_missing
    )
    values["position_id"] = resolved_id
    values["position"] = resolved_name
    return values


def tag_view(row: Tag) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "color": row.color,
        "is_informational": bool(row.is_informational),
    }


def can_see_informational_tags(db: Session, user: User) -> bool:
    return bool(role_codes(db, user).intersection({"manager", "hr", "admin"}))


def normalize_tag_color(color: str | None) -> str:
    value = (color or DEFAULT_TAG_COLOR).strip().upper()
    if len(value) == 7 and value.startswith("#"):
        # accept both upper/lower from clients; store canonical from whitelist
        lookup = {c.upper(): c for c in TAG_COLORS}
        if value in lookup:
            return lookup[value]
    raise HTTPException(422, "Nieprawidłowy kolor tagu")


@router.get("/tags")
def list_tags(user: User = Depends(current_user), db: Session = Depends(get_db)):
    statement = select(Tag).where(Tag.organization_id == user.organization_id)
    if not can_see_informational_tags(db, user):
        statement = statement.where(Tag.is_informational.is_(False))
    rows = db.scalars(statement.order_by(Tag.name)).all()
    return [tag_view(row) for row in rows]


@router.post("/tags", status_code=201)
def create_tag(data: TagIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    name = data.name.strip()
    if db.scalar(select(Tag.id).where(Tag.organization_id == user.organization_id, Tag.name == name)):
        raise HTTPException(409, "Tag już istnieje")
    color = normalize_tag_color(data.color)
    row = Tag(
        organization_id=user.organization_id,
        name=name,
        color=color,
        is_informational=bool(data.is_informational),
    )
    db.add(row)
    db.flush()
    audit(db, user, "tag.create", "tag", row.id)
    db.commit()
    return tag_view(row)


@router.patch("/tags/{tag_id}")
def patch_tag(
    tag_id: UUID, data: TagPatch, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    require_role(db, user, "admin", "hr")
    row = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.organization_id == user.organization_id))
    if not row:
        raise HTTPException(404, "Nie znaleziono tagu")
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload:
        name = payload["name"].strip()
        if not name:
            raise HTTPException(422, "Nazwa tagu jest wymagana")
        existing = db.scalar(
            select(Tag.id).where(
                Tag.organization_id == user.organization_id,
                Tag.name == name,
                Tag.id != row.id,
            )
        )
        if existing:
            raise HTTPException(409, "Tag już istnieje")
        row.name = name
    if "color" in payload:
        row.color = normalize_tag_color(payload["color"])
    if "is_informational" in payload:
        row.is_informational = bool(payload["is_informational"])
    audit(db, user, "tag.update", "tag", row.id)
    db.commit()
    db.refresh(row)
    return tag_view(row)


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    row = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.organization_id == user.organization_id))
    if not row:
        raise HTTPException(404, "Nie znaleziono tagu")
    db.execute(delete(EmployeeTag).where(EmployeeTag.tag_id == row.id))
    db.delete(row)
    audit(db, user, "tag.delete", "tag", tag_id)
    db.commit()
    return Response(status_code=204)


@router.get("/positions")
def list_positions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Position).where(Position.organization_id == user.organization_id).order_by(Position.name)
    ).all()
    return [{"id": str(row.id), "name": row.name} for row in rows]


@router.post("/positions", status_code=201)
def create_position(data: PositionIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    name = data.name.strip()
    if db.scalar(select(Position.id).where(Position.organization_id == user.organization_id, Position.name == name)):
        raise HTTPException(409, "Stanowisko już istnieje")
    row = Position(organization_id=user.organization_id, name=name)
    db.add(row)
    db.flush()
    audit(db, user, "position.create", "position", row.id)
    db.commit()
    return {"id": str(row.id), "name": row.name}


@router.delete("/positions/{position_id}", status_code=204)
def delete_position(position_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(db, user, "admin", "hr")
    row = db.scalar(
        select(Position).where(Position.id == position_id, Position.organization_id == user.organization_id)
    )
    if not row:
        raise HTTPException(404, "Nie znaleziono stanowiska")
    employees = db.scalars(select(Employee).where(Employee.position_id == row.id)).all()
    for employee in employees:
        employee.position_id = None
        employee.position = None
    db.delete(row)
    audit(db, user, "position.delete", "position", position_id)
    db.commit()
    return Response(status_code=204)


