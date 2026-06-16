# BigQuery Release Notes Tracker & Tweet Hub

A premium, modern web dashboard built with Python Flask and vanilla HTML, CSS, and JavaScript. It polls, categorizes, displays, and facilitates tweeting about individual Google Cloud BigQuery release updates.

---

## ✨ Features

- **Granular Update Parsing**: Automatically separates monthly/daily Google Cloud feed entries into individual update blocks.
- **Visual Categorization**: Color-coded badges for **Features**, **Issues**, **Deprecations**, and **Changes**.
- **Real-Time Client Filters**: Instant search box and tag-based category filtering on the frontend.
- **Shimmer Loading State**: Seamless UX utilizing modern animated CSS skeleton card loaders.
- **Smart Tweet Composer Modal**: 
  - Automatically drafts a structured post incorporating update details, hashtags, and links.
  - Character counter featuring X (Twitter) rules (counting URLs as exactly 23 characters).
  - Pixel-perfect dark-mode tweet card preview updating in real time as you edit.
  - Integration with X Web Intent.

---

## 🛠️ Project Structure

```
agy-cli-projects/
│
├── app.py                # Flask Backend (Feed fetching, XML Parsing, Routing)
├── templates/
│   └── index.html        # Dashboard Page Structure & Modal Layout
├── static/
│   ├── css/
│   │   └── style.css     # UI Theme styling (Glassmorphism, animations, layout)
│   └── js/
│       └── app.js        # UI State, DOM operations, & Composer Event Listeners
├── .gitignore            # Version control exclusions
└── README.md             # This file
```

---

## 🚀 Tech Stack

* **Backend**: Python 3.13+, Flask 3.1+
* **Backend Libraries**: `xml.etree.ElementTree` (built-in XML parsing), `urllib.request` (built-in HTTP requests)
* **Frontend**: Vanilla HTML5, Vanilla JavaScript (ES6), Vanilla CSS3 (Custom Properties, Flexbox, CSS Grid)
* **Design Accents**: FontAwesome Icons (Icons), Inter (Google Font)

---

## 💻 Local Setup & Running Instructions

### 1. Prerequisites
Ensure you have **Python 3** installed on your system.

### 2. Install Flask
If not already installed, run:
```bash
pip install Flask
```

### 3. Launch the Server
Execute the Flask server from the root of the project directory:
```bash
python app.py
```

By default, the server runs with hot reloading active on:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔄 How It Works (Request Lifecycle)

1. The client hits `GET /` and downloads `index.html`, which requests the CSS and JS bundles.
2. The client immediately fetches `/api/release-notes` to load the feeds.
3. The server queries `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml` with a desktop user-agent, fetches the Atom XML feed, and parses it.
4. The server responds to the browser with a clean JSON array representing the feed entries.
5. `app.js` runs the HTML payload of each feed entry through a local `DOMParser`, splitting updates by `<h3>` tags.
6. The frontend renders structured date groups and individual cards dynamically.

---

## 🧑‍💻 Contributing
This project is set up with a clean `.gitignore` structure. To commit new updates:
```bash
git add .
git commit -m "Your description of updates"
git push origin main
```
