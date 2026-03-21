import hashlib
from datetime import datetime
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    password = _truncate_for_bcrypt(password)
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    password = _truncate_for_bcrypt(password)
    return pwd_context.verify(password, password_hash)


def _truncate_for_bcrypt(password: str) -> str:
    """Ensure password is at most 72 bytes for bcrypt.

    bcrypt (and passlib's bcrypt) only accept passwords up to 72 bytes.
    We truncate the UTF-8 bytes to 72 bytes and decode with ``errors='ignore'``
    so we don't cut a multibyte character in the middle.
    """
    # Handle bytes directly to avoid turning them into "b'... '" repr
    if isinstance(password, bytes):
        b = password
        # decode for returning as str (passlib accepts str)
        if len(b) <= 72:
            return b.decode('utf-8', errors='ignore')
        return b[:72].decode('utf-8', errors='ignore')

    if isinstance(password, str):
        b = password.encode('utf-8', errors='ignore')
    else:
        # Fallback: coerce other types to str then encode
        password = str(password)
        b = password.encode('utf-8', errors='ignore')

    if len(b) <= 72:
        return password
    truncated = b[:72]
    return truncated.decode('utf-8', errors='ignore')


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def utcnow():
    return datetime.utcnow()

