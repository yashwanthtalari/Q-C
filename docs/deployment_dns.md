# Production Hosting, DNS, and Reverse Proxy Architecture

To deploy **Q/C Quiz on Class** into a production cloud infrastructure, follow these instructions to configure domain routing, SSL certificates, and WebSocket proxies.

---

## 1. Subdomain Topology

We decouple the stateless Next.js client from the stateful Express/Socket.IO game server to optimize load and network latency:

| Target Component | Production Domain Path | Hosting Recommendation |
| :--- | :--- | :--- |
| **Frontend Web App** | `app.quizclass.com` (or `quizclass.com`) | Vercel / Netlify / Cloudflare Pages |
| **Backend REST & WS** | `api.quizclass.com` | AWS EC2 / DigitalOcean / Railway |
| **PostgreSQL Database** | (Private network loop) | Supabase / Neon / AWS RDS |

---

## 2. DNS Settings (Cloudflare or Domain Provider)

Log in to your DNS provider panel and configure the following mapping rules:

1. **Frontend App CNAME**:
   - **Type**: `CNAME`
   - **Name**: `app` (or `@` for root)
   - **Target**: `cname.vercel-dns.com` (if deploying to Vercel)
   - **TTL**: Auto

2. **Backend API A Record**:
   - **Type**: `A`
   - **Name**: `api`
   - **Value**: `YOUR_VPS_PUBLIC_IP_ADDRESS`
   - **TTL**: Auto

---

## 3. Nginx Reverse Proxy Setup (for `api.quizclass.com`)

Since WebSockets (`Socket.IO`) require a persistent connection, a standard HTTP proxy will drop connection packets. You must configure Nginx to forward the `Upgrade` headers.

Create a virtual host configuration file at `/etc/nginx/sites-available/quiz-api`:

```nginx
server {
    listen 80;
    server_name api.quizclass.com;

    # Redirect all HTTP requests to HTTPS (uncomment after SSL configuration)
    # return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.quizclass.com;

    # SSL certificates handled by Certbot (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.quizclass.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.quizclass.com/privkey.pem;
    
    # Modern TLS configurations
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';

    # Max body upload size for quiz text files
    client_max_body_size 10M;

    # REST Endpoint Proxy
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded-for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Socket.IO connection proxy
    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        
        # Upgrade header rules (Mandatory for WS)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded-for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep connection open without timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the site configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/quiz-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Let's Encrypt SSL Installation (via Certbot)

Run Certbot to fetch free automated SSL certificates for the backend API:
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.quizclass.com
```
Certbot will modify the Nginx host configurations to inject the Let's Encrypt certificate keys automatically.

---

## 5. Production Environment Variables Setup

When launching production, supply these variables (Vercel settings for frontend, `.env` file on backend):

### Frontend Environment (Vercel)
- `NEXT_PUBLIC_API_URL`: `https://api.quizclass.com`
- `NEXT_PUBLIC_WS_URL`: `https://api.quizclass.com`

### Backend Environment (VPS)
- `PORT`: `4000`
- `DATABASE_URL`: `postgresql://db_user:db_password@rds-instance-ip:5432/db_name?schema=public`
- `JWT_SECRET`: `YOUR_SECURE_JWT_SIGNATURE_KEY`
