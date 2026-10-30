# Harbour Light Hotel booking

## Development
    pip install -r requirements.txt
    python app.py            # http://127.0.0.1:5000
    FLASK_DEBUG=1 python app.py   # auto-reload, development only

## Production (Linux / macOS)
    gunicorn --workers 1 --threads 4 --bind 0.0.0.0:8000 app:app

## Production (Windows)
    waitress-serve --listen=0.0.0.0:8000 app:app

Put Nginx, Caddy or your host's load balancer in front for HTTPS.

Bookings are stored in bookings.json, so keep to one worker process.
To scale to several workers or servers, move bookings to a database (SQLite or PostgreSQL).
