FROM python:3.12-slim

WORKDIR /app

# Instala dependencias primeiro (layer cacheável)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código fonte
COPY . .

# Variáveis de ambiente padrão
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Exposição da porta
EXPOSE $PORT

CMD python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
