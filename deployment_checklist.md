# 🚀 Deployment checklist for Lending Manager (PautangPal)

This guide provides a step-by-step checklist for deploying the **Lending Manager** application to a VPS (e.g., DigitalOcean, Linode, AWS EC2) using **Nginx** and **PM2** (or static hosting).

---

## 🏗️ 1. Server Preparation
- [ ] **Access Server**: SSH into your VPS (`ssh root@your_server_ip`).
- [ ] **Update System**: Run `sudo apt update && sudo apt upgrade -y`.
- [ ] **Install Node.js**: Install the LTS version (Node 18+ recommended).
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- [ ] **Install Git**: `sudo apt install git -y`.
- [ ] **Install Nginx**: `sudo apt install nginx -y`.
- [ ] **Install PM2**: `sudo npm install -g pm2`.

---

## 🗄️ 2. Database & Backend (Supabase)
- [ ] **Create Project**: Ensure you have a project created at [database.new](https://database.new).
- [ ] **Run SQL Schema**: Copy the contents of `supabase_setup.sql` and run it in the **Supabase SQL Editor**.
- [ ] **Storage Buckets**: Verify that the `borrower-ids` bucket is created and set to **Public**.
- [ ] **RLS Policies**: Confirm that the policies in the SQL file were applied correctly to allow data access.

---

## 💻 3. Application Deployment
- [ ] **Clone Repository**: 
  ```bash
  git clone https://github.com/thetz25/LendingManagement.git
  cd LendingManagement
  ```
- [ ] **Install Dependencies**: `npm install`.
- [ ] **Environment Variables**: Create a `.env` file (Vite requires `VITE_` prefix for production if not using `constants.ts`).
  *Note: Current app uses `constants.ts` for Supabase credentials. Ensure these matches your production Supabase project.*
- [ ] **Build the App**: 
  ```bash
  npm run build
  ```
  This creates a `dist/` folder with optimized static files.

---

## 🌐 4. Nginx Configuration
- [ ] **Configure Site**: Create a new Nginx config file.
  ```bash
  sudo nano /etc/nginx/sites-available/lending-manager
  ```
- [ ] **Paste Configuration**:
  ```nginx
  server {
      listen 80;
      server_name your_domain_or_ip;

      location / {
          root /path/to/LendingManagement/dist;
          index index.html;
          try_files $uri $uri/ /index.html;
      }
  }
  ```
- [ ] **Enable Site**: 
  ```bash
  sudo ln -s /etc/nginx/sites-available/lending-manager /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl restart nginx
  ```

---

## 🔒 5. Security & SSL
- [ ] **Firewall**: Allow HTTP/HTTPS traffic.
  ```bash
  sudo ufw allow 'Nginx Full'
  ```
- [ ] **Install SSL (Certbot)**:
  ```bash
  sudo apt install certbot python3-certbot-nginx -y
  sudo certbot --nginx -d your_domain.com
  ```

---

## 🛠️ 6. Post-Deployment Verification
- [ ] **Check External URL**: Navigate to your domain and ensure the dashboard loads.
- [ ] **Test Connectivity**: Try adding a "Test Borrower" to confirm Supabase connection works.
- [ ] **Mobile Check**: Test the `/#/check` route on a mobile device to ensure the Borrower Portal is responsive.

---

## 💡 Troubleshooting
- **404 on Refresh**: Ensure the Nginx `try_files` directive is set correctly, as this is a Single Page Application (SPA).
- **Supabase Errors**: Check browser console for `403` or `401` errors related to RLS policies.
- **Vite Build Issues**: Ensure the server has at least 1GB of RAM for the build process, or build locally and upload the `dist/` folder via SCP.
