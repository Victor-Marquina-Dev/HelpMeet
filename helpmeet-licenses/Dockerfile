FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Directorio para volumen persistente
RUN mkdir -p /data

EXPOSE 8080

CMD ["sh", "-c", "alembic upgrade head && uvicorn helpmeet_licenses.main:app --host 0.0.0.0 --port 8080"]
