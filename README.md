
# Poridhi Lab Tracker

Poridhi Lab Tracker is a productivity tool designed to help users efficiently track their progress on labs and modules within the poridhi.io platform. It consists of a browser user script and a Cloudflare Worker backend, making it easy to mark labs as complete/incomplete, sync progress, and manage your workflow seamlessly.

## Features

- **Mark Labs/Modules as Done or Incomplete:**
	- Instantly mark any lab or module as completed or not directly from the poridhi.io UI.
- **Progress Syncing:**
	- Your progress is securely synced to a Cloudflare Worker backend, so you can access your status from any device.
- **Tampermonkey Integration:**
	- Simple user script installation for Chrome, Firefox, Edge, and more.
- **Secure API Key Authentication:**
	- All API requests require a user-generated API key for security.
- **Customizable Backend:**
	- Easily deploy your own Cloudflare Worker and control your data.
- **User-Friendly Configuration:**
	- Set your API endpoint and key from the Tampermonkey menu.
- **Open Source:**
	- Fully open for customization and self-hosting.

---

## Setup Guide

This project consists of two main components:
- **Poridhi Lab Tracker User Script** (for use with Tampermonkey)
- **Cloudflare Worker API** (backend service)

Follow the instructions below to set up both components for a seamless experience.

---

## 1. Tampermonkey User Script Setup

### Prerequisites
- [Tampermonkey](https://www.tampermonkey.net/) extension installed in your browser (Chrome, Firefox, Edge, etc.)
- The `poridhi_tracker.user.js` script file from this repository

### Installation Steps
1. **Open Tampermonkey Dashboard** in your browser.
2. Click the **"+" (Create a new script)** button.
3. Copy the contents of `poridhi_tracker.user.js` and paste it into the new script editor.
4. Save the script.

### Configuration
- **API_HOST**: Set this to the URL of your deployed Cloudflare Worker (see below for deployment instructions).
- **API Key**: After installing the script, go to poridhi.io, click the Tampermonkey icon, select the Poridhi Lab Tracker script, and use the menu to set your API key (generated in the Cloudflare Worker setup).

**How to set API_HOST and API Key:**
- Open the Tampermonkey dashboard.
- Find the Poridhi Lab Tracker script and click on it.
- Look for the script menu or settings (usually accessible via the script's menu icon or by right-clicking the script name).
- Enter your Cloudflare Worker URL as `API_HOST` and paste your API key.

---

## 2. Cloudflare Worker Setup

### Prerequisites
- [Email verified Cloudflare account](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/get-started/) installed (`npm install -g wrangler`)
- Node.js and npm installed

### Steps

#### 1. Clone the Repository
```sh
git clone <this-repo-url>
cd poridhi-lab-tracker/worker
```

#### 2. Install Dependencies
```sh
npm install
```

#### 3. Generate an API Key
Use `openssl` to generate a secure API key:
```sh
openssl rand -hex 32
```
Copy the generated key. You will use this in both the worker and the user script.

#### 4. Set the API Key as an Environment Variable
Set the API key in your environment (replace `<your-api-key>` with the key you generated):
```sh
wrangler secret put API_KEY
```
You will be prompted to enter the value. Paste your API key and press Enter.

#### 5. Configure the Worker
- Edit `wrangler.jsonc` if needed to set your account and project details.

#### 6. Deploy the Worker
```sh
npx wrangler deploy
```
After deployment, note the worker URL (e.g., `https://your-worker-name.your-account.workers.dev`).

---

## 3. Connecting the Script and Worker
- In the Tampermonkey script, set `API_HOST` to your deployed worker URL.
- Set the API key in the script menu as described above.

---

## Troubleshooting
- **CORS Issues**: Tampermonkey will prompt you to allow cross-origin requests. Make sure to allow them for the worker URL.
- **Invalid API Key**: Double-check that the API key in Tampermonkey matches the one set in the worker.
- **Deployment Errors**: Check your Cloudflare account and wrangler configuration.

---

## Security Notes
- Keep your API key secret. Do not share it publicly.
- Update your API key regularly to maintain security.

---

## Resources
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

Enjoy!