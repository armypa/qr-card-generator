
# Embeddable QR Code Business Card Generator (MVP)

This package contains:
- **frontend/qr-card-widget.js** — a single-file embeddable widget
- **demo/index.html** — a quick demo page
- **server/** — minimal Express + SQLite backend

## Quick Start

1) **Run the backend:**
```bash
cd server
npm install
npm run dev
```
This starts at `http://localhost:3000`

2) **Open the demo:**
Open `demo/index.html` in your browser. It embeds the widget and points to the local backend.

3) **Use it:**
- Fill the form, check consent
- Click **Generate** to see a live QR preview
- Download **PNG**, **SVG**, or **.vcf**
- Click **Submit to Backend** to save the data
- You’ll get a hosted profile URL like `http://localhost:3000/c/abcd1234`

## Embed on your site

Place this on your page:
```html
<script src="https://your-cdn.example.com/qr-card-widget.js"></script>
<qr-card-generator api-base="https://your-backend.example.com" brand-name="Your Brand"></qr-card-generator>
```

Or mount manually:
```html
<div id="widget-here"></div>
<script src="https://your-cdn.example.com/qr-card-widget.js"></script>
<script>
  QRCard.mount("#widget-here", { apiBase: "https://your-backend.example.com", brandName: "Your Brand" });
</script>
```

## Notes
- The widget lazy-loads a small QR library from a CDN. You can inline or self-host it later.
- For production: set `CORS_ORIGIN`, add authentication for admin endpoints, and review your privacy policy/consent copy.
