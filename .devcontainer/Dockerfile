ARG VARIANT=latest
FROM node:${VARIANT}

# Install required packages
RUN apt-get update \
    && apt-get -y install --no-install-recommends \
        git \
        ldap-utils \
    && apt-get auto-remove -y \
    && apt-get clean -y \
    && chsh -s $(which bash) node

# Install PNPM
RUN npm install -g pnpm

# Setup user and workspace
USER node
WORKDIR /home/node/workspace
