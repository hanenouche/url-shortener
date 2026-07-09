# URL Shortener

A small client-side URL shortener built with React and Vite.

## Run it

```bash
npm install
npm run dev      # app on http://localhost:5173
npm test         # unit tests
```

## Features

- Shorten a long URL and get a short link like `/#/aB3xY9k`
- Retrieve the original URL from a code or a full short link
- Opening a short link redirects to the original URL
- Optional expiration (1, 7 or 30 days)
- Click counter per link
- Links persist in localStorage
- Light/dark mode, responsive layout

## Stack

React 19, Vite, Vitest for the unit tests, lucide-react for icons. Core logic lives in `src/lib/shortener.js`, framework-free.
