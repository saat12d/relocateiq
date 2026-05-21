"""
Unit tests for app.auth.security.

These tests cover the four public functions and the InvalidTokenError
exception. Everything here requires no databas and no network, so the tests
run fast

What we're verifying:
    - Passwords hash to something that is NOT the plaintext, and verify correctly.
    - Wrong passwords fail verification.
    - The same password hashed twice produces different hashes (salting).
    - Tokens round-trip: a token we create decodes back to the same user id.
    - Tampered, malformed, and expired tokens are rejected.

Run with:  pytest test_security.py -v
"""

import time
import uuid

import pytest
from jose import jwt

from app.auth import security
from app.auth.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


# --- Password hashing tests ---


def test_hash_password_does_not_return_plaintext():
    """The stored hash must never be the original password."""
    password = "correct horse battery staple"
    hashed = hash_password(password)
    assert hashed != password
    # bcrypt hashes start with a recognizable prefix
    assert hashed.startswith("$2")
    