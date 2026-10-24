"""Trusted reverse-proxy helpers (client IP from X-Forwarded-For)."""

from __future__ import annotations

import ipaddress
import os

from fastapi import Request


def _parse_trusted_proxies(raw: str | None = None) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    value = (raw if raw is not None else os.getenv("TRUSTED_PROXIES", "")).strip()
    if not value:
        return []
    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for part in value.split(","):
        item = part.strip()
        if not item:
            continue
        try:
            networks.append(ipaddress.ip_network(item, strict=False))
        except ValueError:
            continue
    return networks


def _ip_in_trusted(host: str, trusted: list[ipaddress.IPv4Network | ipaddress.IPv6Network]) -> bool:
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(addr in net for net in trusted)


def client_ip(request: Request) -> str:
    """Peer address, or leftmost X-Forwarded-For hop when peer is a trusted proxy."""
    peer = request.client.host if request.client else "unknown"
    trusted = _parse_trusted_proxies()
    if not trusted or not _ip_in_trusted(peer, trusted):
        return peer
    forwarded = request.headers.get("x-forwarded-for") or ""
    if not forwarded.strip():
        return peer
    # Leftmost = original client when proxies append to the right.
    first = forwarded.split(",")[0].strip()
    if not first:
        return peer
    try:
        ipaddress.ip_address(first)
    except ValueError:
        return peer
    return first
