from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal
from app.models.edital import EditalModel
from app.services.storage_service import StorageError, StorageService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migra referencias locais de editais para o storage configurado."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra o que seria migrado sem alterar o banco nem enviar arquivos.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limita a quantidade de editais processados nesta execucao.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    storage = StorageService()

    if storage.settings.storage_backend.lower() == "local":
        print("STORAGE_BACKEND=local. Nada a migrar para bucket remoto.")
        return 0

    db = SessionLocal()
    migrated = 0
    skipped = 0
    failed = 0
    processed = 0

    try:
        editais = db.scalars(select(EditalModel).order_by(EditalModel.id.asc())).all()
        for edital in editais:
            if args.limit and processed >= args.limit:
                break
            processed += 1

            reference = edital.arquivo_path
            if not reference:
                skipped += 1
                print(f"[skip] edital {edital.id}: sem arquivo_path")
                continue

            if storage.is_remote_reference(reference):
                skipped += 1
                print(f"[skip] edital {edital.id}: ja migrado ({reference})")
                continue

            try:
                content = storage.read_bytes(reference)
            except StorageError as exc:
                failed += 1
                print(f"[erro] edital {edital.id}: nao foi possivel ler origem {reference!r}: {exc}")
                continue

            filename = edital.arquivo_nome or Path(reference).name or "edital.pdf"
            if args.dry_run:
                print(f"[dry-run] edital {edital.id}: {reference!r} -> bucket://.../{filename}")
                migrated += 1
                continue

            try:
                new_reference = storage.save_edital(edital.licitacao_id, filename, content)
            except StorageError as exc:
                failed += 1
                print(f"[erro] edital {edital.id}: falha ao gravar no storage remoto: {exc}")
                continue

            edital.arquivo_path = new_reference
            db.add(edital)
            migrated += 1
            print(f"[ok] edital {edital.id}: {reference!r} -> {new_reference!r}")

        if not args.dry_run:
            db.commit()
    finally:
        db.close()

    print(
        f"Concluido. processados={processed} migrados={migrated} pulados={skipped} falhas={failed} dry_run={args.dry_run}"
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
