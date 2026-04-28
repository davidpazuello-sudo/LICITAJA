from sqlalchemy import Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ItemModel(Base):
    __tablename__ = "itens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    licitacao_id: Mapped[int] = mapped_column(
        ForeignKey("licitacoes.id", ondelete="CASCADE"),
        nullable=False,
    )
    edital_id: Mapped[int | None] = mapped_column(ForeignKey("editais.id"), nullable=True)
    numero_item: Mapped[int] = mapped_column(Integer, nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    quantidade: Mapped[float | None] = mapped_column(Float, nullable=True)
    unidade: Mapped[str | None] = mapped_column(String, nullable=True)
    especificacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    marcas_fabricantes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_pesquisa: Mapped[str] = mapped_column(String, nullable=False, default="aguardando")
    preco_medio: Mapped[float | None] = mapped_column(Float, nullable=True)
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

    licitacao = relationship("LicitacaoModel", back_populates="itens")
    edital = relationship("EditalModel", back_populates="itens")
    cotacoes = relationship("CotacaoModel", back_populates="item", cascade="all, delete-orphan")
