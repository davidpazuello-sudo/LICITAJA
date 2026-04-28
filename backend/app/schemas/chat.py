from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatMessageRead(BaseModel):
    id: int
    licitacao_id: int
    role: str
    content: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class ChatConversationResponse(BaseModel):
    messages: list[ChatMessageRead] = Field(default_factory=list)
