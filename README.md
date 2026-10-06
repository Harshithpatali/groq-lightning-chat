# ⚡ Lightning — Ultra-Fast AI Chat powered by Groq

A production-ready, beautiful AI chat application that leverages **Groq's LPU chips** for the fastest inference available (500–1000+ tokens/sec).

![Lightning](https://img.shields.io/badge/Powered%20by-Groq-orange?style=flat-square)
![Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)

## ✨ Features

- **Streaming responses** via Server-Sent Events (SSE)
- **Multiple Groq models**: Llama 3.1 8B Instant, Llama 3.3 70B, GPT-OSS 20B/120B
- **Multi-chat history** with localStorage persistence
- **Markdown + syntax highlighting** with one-click code copy
- **Custom system prompt**
- **Modern dark UI** — responsive, glass-smooth, mobile-friendly
- **Secure API proxy** — your Groq key never leaves the server
- **One-click deploy** to Cloudflare Pages

## 🚀 Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Create a .dev.vars file for local Cloudflare Functions (optional)
echo "GROQ_API_KEY=gsk_your_key_here" > .dev.vars

# 3. Run the frontend
npm run dev
```

> For full local API testing with the Functions layer:
> ```bash
> npm run build
> npx wrangler pages dev dist --binding GROQ_API_KEY=gsk_your_key_here
> ```

Open http://localhost:5173

## ☁️ Deploy to Cloudflare Pages (Recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Lightning AI Chat"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/groq-lightning-chat.git
git push -u origin main
```

### 2. Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create application** → **Pages** → **Connect to Git**
3. Select your repository
4. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave default)
5. Click **Save and Deploy**

### 3. Add your Groq API Key (Secret)

1. In the Pages project → **Settings** → **Environment variables**
2. Add:
   - **Variable name**: `GROQ_API_KEY`
   - **Value**: your key from [console.groq.com](https://console.groq.com/keys)
   - **Environment**: Production (and Preview if desired)
3. Redeploy (or push a new commit)

Your app will be live at `https://your-project.pages.dev`

## 🔑 Getting a Groq API Key

1. Sign up at [console.groq.com](https://console.groq.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `gsk_`)

Groq offers a generous free tier.

## 📁 Project Structure

```
groq-lightning-chat/
├── functions/
│   └── api/
│       └── chat.ts          # Cloudflare Pages Function (proxies Groq API)
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx              # Main chat UI + logic
│   ├── index.css            # Tailwind + custom styles
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

## 🛠 Tech Stack

| Layer        | Tech                          |
|--------------|-------------------------------|
| Frontend     | React 19 + TypeScript + Vite  |
| Styling      | Tailwind CSS v4               |
| Markdown     | react-markdown + highlight.js |
| Icons        | Lucide React                  |
| Backend      | Cloudflare Pages Functions    |
| AI           | Groq OpenAI-compatible API    |

## 🔒 Security Notes

- The Groq API key is stored **only** as a Cloudflare environment variable.
- The frontend never sees the key — all requests go through `/api/chat`.
- Never commit `.dev.vars` or any file containing your key.

## 📝 License

MIT — build something amazing.

---

Made with ⚡ by Lightning · Powered by Groq
