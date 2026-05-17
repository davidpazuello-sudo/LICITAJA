from datetime import UTC, datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LicitacaoMonitoramentoModel(Base):
    __tablename__ = "licitacoes_monitoramento"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    licitacao_id: Mapped[int] = mapped_column(
        ForeignKey("licitacoes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    monitoramento_ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status_remoto: Mapped[str | None] = mapped_column(String, nullable=True)
    ultima_verificacao_em: Mapped[str | None] = mapped_column(String, nullable=True)
    proxima_verificacao_em: Mapped[str | None] = mapped_column(String, nullable=True)
    ultima_mudanca_detectada_em: Mapped[str | None] = mapped_column(String, nullable=True)
    ultimo_hash_dados: Mapped[str | None] = mapped_column(String, nullable=True)
    ultimo_hash_editais: Mapped[str | None] = mapped_column(String, nullable=True)
    ultimo_erro_monitoramento: Mapped[str | None] = mapped_column(Text, nullable=True)
    resumo_ultima_mudanca: Mapped[str | None] = mapped_column(Text, nullable=True)
    tentativas_consecutivas_erro: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    criado_em: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=lambda: datetime.now(UTC).isoformat(),
    )
    atualizado_em: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=lambda: datetime.now(UTC).isoformat(),
        onupdate=lambda: datetime.now(UTC).isoformat(),
    )

    licitacao = relationship("LicitacaoModel", back_populates="monitoramento")
