FROM node:10


# Create app directory
WORKDIR /opt

ARG wh_dbhost
ARG wh_dbuser
ARG wh_dbpassword
ARG wh_database
ARG dbhost
ARG dbuser
ARG dbpassword
ARG database
ARG debugging
ARG logfile=./checkins.log
ARG firebase_service_account
ARG firebase_db_url
ARG application_link
ARG notification_email_address
ARG sns_access_key
ARG sns_secret_key
ARG sns_region
ARG port

ENV wh_dbhost=$wh_dbport
ENV wh_dbuser=$wh_dbuser
ENV wh_dbpassword=$wh_dbpassword
ENV wh_database=$wh_database
ENV dbhost=$dbport
ENV dbuser=$dbuser
ENV dbpassword=$dbpassword
ENV database=$database
ENV logfile=$logfile
ENV debugging=$debugging
ENV firebase_service_account=$firebase_service_account
ENV firebase_db_url=$irebase_db_url
ENV application_link=$application_link
ENV notification_email_address=$notification_email_address
ENV aws_access_key_id=$sns_access_key
ENV aws_secret_access_key=$sns_secret_key
ENV aws_region=$sns_region

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

EXPOSE $port

ENTRYPOINT [ "npm", "start" ]

