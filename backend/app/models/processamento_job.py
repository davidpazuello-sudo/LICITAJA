from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ProcessamentoJobModel(Base):
    __tablename__ = "processamento_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    licitacao_id: Mapped[int | None] = mapped_column(
        ForeignKey("licitacoes.id", ondelete="CASCADE"),
        nullable=True,
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued")
    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=lambda: datetime.now(UTC).isoformat(),
    )
    iniciado_em: Mapped[str | None] = mapped_column(String, nullable=True)
    finalizado_em: Mapped[str | None] = mapped_column(String, nullable=True)
    atualizado_em: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=lambda: datetime.now(UTC).isoformat(),
        onupdate=lambda: datetime.now(UTC).isoformat(),
    )

    licitacao = relationship("LicitacaoModel", back_populates="jobs_processamento")
