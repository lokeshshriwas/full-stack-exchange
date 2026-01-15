#####  To Edit the domain name #####

# 1. Edit nginx
sudo nano /etc/nginx/sites-available/api

# 2. Get SSL
sudo certbot --nginx -d newdomain.com

# 3. Update CORS
nano .env

# 4. Restart
sudo systemctl reload nginx && docker compose -f docker-compose.prod.yml restart api

##############################################################################

######## Build and deploy frontend or any single service ########

cd frontend-main
npm run build
docker build -t lokeshshriwas/exchange-frontend:latest .
docker push lokeshshriwas/exchange-frontend:

# ON EC2

docker compose -f docker-compose.prod.yml pull frontend
docker compose -f docker-compose.prod.yml down frontend
docker compose -f docker-compose.prod.yml up -d frontend



##############################################################################

# To make server autostart when ec2 restarts

####### Create a system service #######
sudo nano /etc/systemd/system/exchange.service

#add this content
[Unit]
Description=Exchange Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down

[Install]
WantedBy=multi-user.target

# enable it :
sudo systemctl enable exchange.service