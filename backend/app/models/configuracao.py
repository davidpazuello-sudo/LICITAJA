from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfiguracaoModel(Base):
    __tablename__ = "configuracoes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chave: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    valor: Mapped[str] = mapped_column(String, nullable=False)

