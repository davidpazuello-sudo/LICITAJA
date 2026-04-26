from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class EditalModel(Base):
    __tablename__ = "editais"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    licitacao_id: Mapped[int] = mapped_column(
        ForeignKey("licitacoes.id", ondelete="CASCADE"),
        nullable=False,
    )
    arquivo_nome: Mapped[str | None] = mapped_column(String, nullable=True)
    arquivo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_extracao: Mapped[str] = mapped_column(String, nullable=False, default="pendente")
    erro_mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(
        String,
        nullable=False,
        server_default=func.datetime("now"),
    )

    licitacao = relationship("LicitacaoModel", back_populates="editais")
    itens = relationship("ItemModel", back_populates="edital")
