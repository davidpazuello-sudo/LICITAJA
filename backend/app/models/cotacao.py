from sqlalchemy import Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CotacaoModel(Base):
    __tablename__ = "cotacoes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("itens.id", ondelete="CASCADE"), nullable=False)
    fornecedor_nome: Mapped[str] = mapped_column(String, nullable=False)
    preco_unitario: Mapped[float | None] = mapped_column(Float, nullable=True)
    fonte_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    fonte_nome: Mapped[str | None] = mapped_column(String, nullable=True)
    data_cotacao: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=func.datetime("now"),
    )
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=func.datetime("now"),
    )

    item = relationship("ItemModel", back_populates="cotacoes")
