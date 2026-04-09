ARG NODE_VERSION=20.15.0
ARG PNPM_VERSION=9.4.0

FROM python:3.12-slim-bookworm

# Use a portable shell until bash is installed.
SHELL ["/bin/sh", "-c"]

## for apt to be noninteractive
ENV DEBIAN_FRONTEND="noninteractive"
ENV DEBCONF_NONINTERACTIVE_SEEN="true"
# ENV NODE_ENV production

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    bison \
    cmake \
    curl \
    flex \
    g++ \
    gawk \
    gcc \
    git \
    graphviz \
    gzip \
    infernal \
    make \
    wget \
    && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-c"]

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel

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
RUN python -m pip install --no-cache-dir \
    appdirs \
    biopython \
    faiss-cpu \
    graphviz \
    mmcif \
    numpy \
    ordered-set \
    orjson \
    pandas \
    pulp \
    requests \
    scikit-learn \
    scipy \
    tqdm \
    ViennaRNA && \
    python -m pip install --no-cache-dir .
ENV PATH="$PATH:/root/.local/bin"

# add scripts to path
ENV PATH="$PATH:/usr/src/app/scripts"

# install gemmi
RUN python -m pip install --no-cache-dir git+https://github.com/project-gemmi/gemmi.git --config-settings=cmake.args=-DONLY_PROGRAM=ON


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
