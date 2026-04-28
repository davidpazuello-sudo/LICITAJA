from sqlalchemy import Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LicitacaoModel(Base):
    __tablename__ = "licitacoes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    numero_controle: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    numero_processo: Mapped[str | None] = mapped_column(String, nullable=True)
    orgao: Mapped[str] = mapped_column(String, nullable=False)
    uasg: Mapped[str | None] = mapped_column(String, nullable=True)
    objeto: Mapped[str] = mapped_column(Text, nullable=False)
    modalidade: Mapped[str | None] = mapped_column(String, nullable=True)
    valor_estimado: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_abertura: Mapped[str | None] = mapped_column(String, nullable=True)
    estado: Mapped[str | None] = mapped_column(String, nullable=True)
    cidade: Mapped[str | None] = mapped_column(String, nullable=True)
    link_edital: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_site: Mapped[str | None] = mapped_column(Text, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resumo_ia: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="nova")
    fonte: Mapped[str] = mapped_column(String, nullable=False, default="pncp")
    dados_brutos: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=func.datetime("now"),
    )
    updated_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=func.datetime("now"),
        onupdate=func.datetime("now"),
    )

    editais = relationship("EditalModel", back_populates="licitacao", cascade="all, delete-orphan")
    itens = relationship("ItemModel", back_populates="licitacao", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessageModel", back_populates="licitacao", cascade="all, delete-orphan")
