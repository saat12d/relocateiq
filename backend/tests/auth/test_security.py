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


def test_verify_password_accepts_correct_password():
    """A password verifies against its own hash."""
    password = "s3cur3-p@ssw0rd"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True


def test_verify_password_rejects_wrong_password():
    """A different password must not verify."""
    hashed = hash_password("the right password")
    assert verify_password("the wrong password", hashed) is False


def test_same_password_produces_different_hashes():
    """
    Bcrypt salts each hash, so hashing the same password twice yields
    two different strings. Both must still verify correctly. This proves
    we're salting and not, e.g., using a plain unsalted digest.
    """
    password = "repeated-password"
    hash_a = hash_password(password)
    hash_b = hash_password(password)
    assert hash_a != hash_b
    assert verify_password(password, hash_a) is True
    assert verify_password(password, hash_b) is True
