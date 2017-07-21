# Install the services
cp ./converse1.service /etc/systemd/system/
cp ./converse2.service /etc/systemd/system/

# Start the services and enable starting after reboot
systemctl start converse1
systemctl enable converse1
systemctl start converse2
systemctl enable converse2

# Install the NGINX configuration file
cp ./converse.conf /etc/nginx/conf.d/
sudo systemctl restart nginx

