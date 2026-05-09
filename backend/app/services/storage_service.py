from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from app.core.config import get_settings


class StorageError(Exception):
    pass


class StorageService:
    _REMOTE_PREFIX = "storage://"

    def __init__(self) -> None:
        self.settings = get_settings()

    def save_edital(self, licitacao_id: int, filename: str, content: bytes) -> str:
        safe_name = self._normalize_filename(filename or "edital.pdf")
        if self.settings.storage_backend.lower() == "local":
            destination = self._build_local_path(licitacao_id, safe_name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
            return str(destination.resolve())

        key = self._build_remote_key(licitacao_id, safe_name)
        self._put_remote_object(key, content, content_type="application/pdf")
        return f"{self._REMOTE_PREFIX}{key}"

    def is_remote_reference(self, reference: str | None) -> bool:
        return bool(reference and reference.startswith(self._REMOTE_PREFIX))

    def read_bytes(self, reference: str) -> bytes:
        if not reference:
            raise StorageError("Referencia de storage vazia.")

        if reference.startswith(self._REMOTE_PREFIX):
            return self._get_remote_object(reference.removeprefix(self._REMOTE_PREFIX))

        path = Path(reference)
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[2] / reference
        if not path.exists():
            raise StorageError("Arquivo nao encontrado no storage local.")
        return path.read_bytes()

    def exists(self, reference: str) -> bool:
        if not reference:
            return False
        try:
            self.read_bytes(reference)
        except Exception:
            return False
        return True

    def build_public_url(self, reference: str) -> str | None:
        if not reference.startswith(self._REMOTE_PREFIX):
            return None
        key = reference.removeprefix(self._REMOTE_PREFIX)
        if self.settings.storage_public_base_url:
            return f"{self.settings.storage_public_base_url.rstrip('/')}/{key}"
        return None

    def _build_local_path(self, licitacao_id: int, filename: str) -> Path:
        uploads_root = Path(__file__).resolve().parents[2] / self.settings.uploads_dir / str(licitacao_id)
        return uploads_root / filename

    def _normalize_filename(self, filename: str) -> str:
        parsed = urlparse(filename)
        raw_name = Path(parsed.path or filename).name or "edital.pdf"
        return raw_name.replace("\\", "_").replace("/", "_")

    def _build_remote_key(self, licitacao_id: int, filename: str) -> str:
        prefix = self.settings.storage_prefix.strip().strip("/")
        parts = [part for part in [prefix, "editais", str(licitacao_id), filename] if part]
        return "/".join(parts)

    def _build_s3_client(self):
        try:
            import boto3
        except ImportError as exc:
            raise StorageError("Dependencia boto3 ausente para storage remoto.") from exc

        session = boto3.session.Session()
        return session.client(
            "s3",
            region_name=self.settings.storage_region or None,
            endpoint_url=self.settings.storage_endpoint_url or None,
            aws_access_key_id=self.settings.storage_access_key_id or None,
            aws_secret_access_key=self.settings.storage_secret_access_key or None,
        )

    def _put_remote_object(self, key: str, content: bytes, *, content_type: str) -> None:
        if not self.settings.storage_bucket:
            raise StorageError("STORAGE_BUCKET nao configurado para storage remoto.")

        client = self._build_s3_client()
        client.put_object(
            Bucket=self.settings.storage_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    def _get_remote_object(self, key: str) -> bytes:
        if not self.settings.storage_bucket:
            raise StorageError("STORAGE_BUCKET nao configurado para storage remoto.")

        client = self._build_s3_client()
        response = client.get_object(Bucket=self.settings.storage_bucket, Key=key)
        body = response.get("Body")
        if body is None:
            raise StorageError("Objeto remoto sem corpo de resposta.")
        return body.read()
