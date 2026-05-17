from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LicitacaoEventoModel(Base):
    __tablename__ = "licitacoes_eventos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    licitacao_id: Mapped[int] = mapped_column(
        ForeignKey("licitacoes.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_evento: Mapped[str] = mapped_column(String, nullable=False)
    origem: Mapped[str | None] = mapped_column(String, nullable=True)
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=lambda: datetime.now(UTC).isoformat(),
    )

    licitacao = relationship("LicitacaoModel", back_populates="eventos_monitoramento")
