"""
Security primitives for the auth module.
 
This module is the single source of truth for two design decisions that are likely to change someday:
 
    1. How we hash passwords (currently bcrypt via passlib).
    2. How we issue and verify session tokens (currently JWTs via python-jose).
 
Public interface:
    hash_password(plain_password)         -> hashed password string
    verify_password(plain_password, hash) -> bool
    create_access_token(user_id)          -> JWT string
    decode_access_token(token)            -> user_id (UUID string)
 
Anything not in that list is a private implementation detail.

This file will not handle requests, does not talk to the database, and does not "log anyone in." It will just provide the four building blocks for the login flow.
"""

