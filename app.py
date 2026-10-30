import json
import os
import threading
import uuid
from datetime import date, datetime

from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="/static")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BOOKINGS_FILE = os.path.join(BASE_DIR, "bookings.json")
bookings_lock = threading.Lock()  # one booking written at a time

ROOMS = [
    {"id": 1, "name": "Harbour Single", "price": 3800, "sleeps": 1, "size": 22,
     "bed": "1 queen bed", "tone": "#1d6b73",
     "blurb": "A quiet room facing the courtyard, with a writing desk and rain shower."},
    {"id": 2, "name": "Lantern Double", "price": 5200, "sleeps": 2, "size": 28,
     "bed": "1 king bed", "tone": "#c8962e",
     "blurb": "Warm evening light, a window seat, and a view over the old harbour wall."},
    {"id": 3, "name": "Tideline Suite", "price": 8900, "sleeps": 3, "size": 46,
     "bed": "1 king bed + sofa bed", "tone": "#0e4a52",
     "blurb": "Separate lounge, private balcony, and a bathtub that looks out to sea."},
    {"id": 4, "name": "Family Loft", "price": 10400, "sleeps": 5, "size": 58,
     "bed": "2 queen beds + bunk", "tone": "#7a8f5a",
     "blurb": "Two sleeping floors, a small kitchenette, and space for everyone."},
]


def parse_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def stay_nights(checkin, checkout):
    """Return number of nights, or None if the dates are invalid."""
    start, end = parse_date(checkin), parse_date(checkout)
    if not start or not end or start < date.today() or end <= start:
        return None
    return (end - start).days


def load_bookings():
    if not os.path.exists(BOOKINGS_FILE):
        return []
    try:
        with open(BOOKINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_bookings(bookings):
    with open(BOOKINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(bookings, f, indent=2)


@app.route("/")
def home():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/rooms")
def rooms():
    guests = request.args.get("guests", 1, type=int)
    nights = stay_nights(request.args.get("checkin"), request.args.get("checkout"))
    result = []
    for room in ROOMS:
        if room["sleeps"] >= guests:
            item = dict(room)
            item["nights"] = nights
            item["total"] = room["price"] * nights if nights else None
            result.append(item)
    return jsonify(result)


@app.route("/api/bookings", methods=["POST"])
def book():
    data = request.get_json(silent=True) or {}
    room = next((r for r in ROOMS if r["id"] == data.get("room_id")), None)
    nights = stay_nights(data.get("checkin"), data.get("checkout"))
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    guests = data.get("guests")

    if not room:
        return jsonify(error="Choose a room."), 400
    if not nights:
        return jsonify(error="Check-out must be after check-in, and check-in can't be in the past."), 400
    if not name or "@" not in email:
        return jsonify(error="Enter your name and a valid email address."), 400
    if not isinstance(guests, int) or not 1 <= guests <= room["sleeps"]:
        return jsonify(error=f"This room sleeps up to {room['sleeps']} guests."), 400

    booking = {
        "reference": uuid.uuid4().hex[:8].upper(),
        "room": room["name"],
        "name": name,
        "email": email,
        "guests": guests,
        "checkin": data["checkin"],
        "checkout": data["checkout"],
        "nights": nights,
        "total": room["price"] * nights,
    }
    with bookings_lock:
        bookings = load_bookings()
        bookings.append(booking)
        save_bookings(bookings)
    return jsonify(booking), 201


if __name__ == "__main__":
    # Local development only. In production, run with gunicorn or waitress (see README).
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
