import http from "node:http";
import process from "node:process";
import { OAuth2Client } from "google-auth-library";

const port = Number(process.env.GMAIL_OAUTH_PORT ?? "3333");
const redirectUri = `http://localhost:${port}/oauth2callback`;
const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are required.");
  console.error("PowerShell example:");
  console.error("$env:GMAIL_CLIENT_ID='your-client-id'");
  console.error("$env:GMAIL_CLIENT_SECRET='your-client-secret'");
  console.error("npm run gmail:oauth");
  process.exit(1);
}

const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
const scopes = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "openid",
  "email",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", redirectUri);

  if (requestUrl.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Gmail OAuth complete</h1><p>You can close this browser tab and return to the terminal.</p>");

    console.log("");
    console.log("Gmail OAuth complete.");
    console.log("Add this value to Vercel as GMAIL_REFRESH_TOKEN:");
    console.log(tokens.refresh_token ?? "(No refresh token returned. Re-run after removing the app access from your Google Account.)");
    console.log("");
    server.close();
  } catch (error) {
    res.writeHead(500);
    res.end("Failed to exchange OAuth code.");
    console.error(error);
    server.close();
  }
});

server.listen(port, () => {
  console.log("");
  console.log("Open this URL in your browser and approve Gmail access:");
  console.log(authUrl);
  console.log("");
  console.log(`Waiting for OAuth callback on ${redirectUri}`);
});
