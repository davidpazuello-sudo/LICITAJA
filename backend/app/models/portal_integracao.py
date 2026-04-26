from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortalIntegracaoModel(Base):
    __tablename__ = "portal_integracoes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    url_base: Mapped[str] = mapped_column(String, nullable=False)
    tipo_auth: Mapped[str] = mapped_column(String, default="none")
    credencial: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="ativa")
    criado_em: Mapped[str] = mapped_column(String, default="")
