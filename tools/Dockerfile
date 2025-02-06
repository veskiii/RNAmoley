ARG NODE_VERSION=20.15.0
ARG PNPM_VERSION=9.4.0

FROM ubuntu:jammy

# Use production node environment by default.
SHELL ["/bin/bash", "-c"]

## for apt to be noninteractive
ENV DEBIAN_FRONTEND="noninteractive"
ENV DEBCONF_NONINTERACTIVE_SEEN="true"
# ENV NODE_ENV production

RUN apt-get update && \
    apt-get -y install sudo

# install node and npm
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    g++ \
    gcc \
    curl \
    git \
    python3.10-full \
    python3-pip \
    python3.10-dev \
    python-is-python3 \
    npm \
    make \
    gawk \
    bison \
    flex

# install node
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=20.15.0

RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

# Install pnpm.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@${PNPM_VERSION}

# install maxit
WORKDIR /usr/src
RUN wget https://sw-tools.rcsb.org/apps/MAXIT/maxit-v11.200-prod-src.tar.gz && \
    zcat maxit-v11.200-prod-src.tar.gz | tar -xf - && \
    rm maxit-v11.200-prod-src.tar.gz
WORKDIR /usr/src/maxit-v11.200-prod-src
RUN make binary
ENV RCSBROOT="/usr/src/maxit-v11.200-prod-src"
ENV PATH="$PATH:$RCSBROOT/bin"

# install rnapolis
WORKDIR /usr/src
RUN git clone https://github.com/tzok/rnapolis-py
WORKDIR /usr/src/rnapolis-py
RUN sudo pip install .
ENV PATH="$PATH:/root/.local/bin"

# add scripts to path
ENV PATH="$PATH:/usr/src/app/scripts"

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir numpy biopython

# # Run the application as a non-root user.
# RUN useradd -ms /bin/bash node
# USER node

# Copy the rest of the source files into the image.
WORKDIR /usr/src/app
COPY . .

# Expose the port that the application listens on.
EXPOSE 3002

# Run the application.
RUN npm install -g typescript && pnpm i && pnpm build
CMD node dist/server.js
