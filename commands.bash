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
docker push lokeshshriwas/exchange-frontend

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

################################################################################
# Check volume size (should show 20GB)
lsblk

### To increase volumne size and update it ###
# 1. Install growpart tool
sudo apt update
sudo apt install cloud-guest-utils -y
# 2. Grow partition 1 to use all available space
sudo growpart /dev/nvme0n1 1
# 3. Resize the filesystem
sudo resize2fs /dev/nvme0n1p1
# 4. Verify - should now show ~18-19GB
df -h


# To enter into db :
# Connect to PostgreSQL
docker exec -it exchange-timescaledb psql -U postgres -d exchange-platform


###################################################################################
### Clear Redis Cache and db ###

# Option 1: Flush all Redis data (keeps container running)
docker exec -it exchange-redis redis-cli FLUSHALL

# Option 2: Verify Redis is empty
docker exec -it exchange-redis redis-cli DBSIZE
# 1. Exit psql first
\q

# 2. Stop services that connect to the database
docker stop exchange-api exchange-engine exchange-db-worker

# 3. Now connect and drop the database
docker exec -it exchange-timescaledb psql -U postgres -d postgres

# Inside psql:
DROP DATABASE "exchange-platform";
CREATE DATABASE "exchange-platform";
\q

# 4. Start services back up
docker start exchange-api exchange-engine exchange-db-worker

###################################################################################
