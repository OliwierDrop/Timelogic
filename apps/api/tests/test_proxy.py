from fastapi import Request

from app.proxy import client_ip


def _request(peer: str, forwarded: str | None = None) -> Request:
    headers = []
    if forwarded is not None:
        headers.append((b"x-forwarded-for", forwarded.encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": headers,
        "client": (peer, 12345),
        "server": ("test", 80),
    }
    return Request(scope)


def test_client_ip_without_trusted_proxies(monkeypatch):
    monkeypatch.delenv("TRUSTED_PROXIES", raising=False)
    assert client_ip(_request("10.0.0.5", "203.0.113.9")) == "10.0.0.5"


def test_client_ip_uses_forwarded_when_peer_trusted(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXIES", "10.0.0.0/8,127.0.0.1")
    assert client_ip(_request("10.0.0.5", "203.0.113.9, 10.0.0.5")) == "203.0.113.9"


def test_client_ip_ignores_forwarded_from_untrusted_peer(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXIES", "127.0.0.1")
    assert client_ip(_request("198.51.100.1", "203.0.113.9")) == "198.51.100.1"


def test_client_ip_falls_back_when_forwarded_missing(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXIES", "10.0.0.0/8")
    assert client_ip(_request("10.1.2.3")) == "10.1.2.3"
