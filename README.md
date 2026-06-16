# Poker App

A mobile-first poker game management system for tracking rounds, rake, and cashouts.

## Tech Stack

- **Backend**: Node.js / Express (serverless via Vercel)
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Frontend**: Vanilla JS single-page application
## Environment Variables

The app requires four environment variables. Set them in the Vercel dashboard under **Project → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `AUTH_USERNAME` | The username for the host login |
| `AUTH_PASSWORD` | The password for the host login |
| `MONGODB_URI` | MongoDB Atlas connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/poker`) |
| `COOKIE_SECRET` | A long random string used to sign the auth cookie (e.g. generate with `openssl rand -hex 32`) |

### Setting Environment Variables in Vercel

1. Open your project in the [Vercel dashboard](https://vercel.com/dashboard).
2. Navigate to **Settings** → **Environment Variables**.
3. Add each variable listed above with its corresponding value.
4. Select the environments where each variable should apply (Production, Preview, Development).
5. Click **Save** and redeploy for changes to take effect.

> **Note**: Do not commit a `.env` file containing real secrets to version control. Use `.env.example` as a reference template only.

## Local Development

1. Copy `.env.example` to `.env` and fill in your values:
   ```
   cp .env.example .env
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Run tests:
   ```
   npm test
   ```

## Project Structure

```
/
├── api/
│   └── index.js          # Vercel serverless entry point
├── server/
│   ├── app.js            # Express app (no app.listen)
│   ├── db.js             # MongoDB connection
│   ├── routes/           # API route handlers
│   ├── middleware/        # Auth and other middleware
│   └── models/           # Mongoose models
├── lib/
│   └── calc.js           # Shared calculation engine
├── public/               # Static frontend (served by Vercel CDN)
│   ├── index.html
│   ├── main.js
│   ├── styles.css
│   ├── screens/          # Screen modules
│   └── lib/              # Client-side utilities
├── .env.example          # Environment variable template
└── vercel.json           # Vercel routing configuration
```

## Deployment

Push to your connected GitHub repository. Vercel will automatically build and deploy. The `vercel.json` configuration routes all `/api/*` requests to the serverless function and falls back to `public/index.html` for client-side routing.
