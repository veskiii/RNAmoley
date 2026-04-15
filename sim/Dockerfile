FROM ubuntu:jammy

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive
ENV DEBCONF_NONINTERACTIVE_SEEN=true

RUN apt-get update && \
    apt-get -y install --no-install-recommends \
    build-essential \
    ca-certificates \
    csh \
    curl \
    default-jre \
    python3.10 \
    python3-pip \
    python-is-python3 \
    g++ \
    gcc \
    gawk \
    git \
    libgl1 \
    libglu1-mesa \
    libssl-dev \
    libtinfo6 \
    libx11-6 \
    libxext6 \
    libxi6 \
    libxrender1 \
    libxt6 \
    lsof \
    rlwrap \
    software-properties-common \
    wget \
    xauth \
    xterm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tools

ADD NAMD_3.0.2_Linux-x86_64-multicore.tar.gz /tools/
ADD vmd-1.9.3.bin.LINUXAMD64.text.tar.gz /tools/

RUN mv /tools/NAMD_3.0.2_Linux-x86_64-multicore /tools/namd && \
    mv /tools/vmd-1.9.3 /tools/vmd && \
        sed -i \
            -e 's|^#defaultvmddir=/usr/local/lib/vmd$|defaultvmddir=/tools/vmd|' \
            -e 's|^#vmdbasename=vmd$|vmdbasename=vmd|' \
            /tools/vmd/bin/vmd.sh && \
        ln -sfn /tools/vmd/lib/scripts/tcl8.5 /tools/vmd/scripts/tcl && \
        ln -sfn /tools/vmd/lib/scripts/tcl8.5 /tools/vmd/scripts/tcl8.5 && \
        ln -sfn /tools/vmd/lib/scripts/tcl8 /tools/vmd/scripts/tcl8 && \
    chmod -R a+rX /tools/namd /tools/vmd && \
    ln -sf /tools/vmd/LINUXAMD64/vmd_LINUXAMD64 /tools/vmd/vmd_LINUXAMD64 && \
    ln -sf /tools/vmd/LINUXAMD64/vmd_LINUXAMD64 /usr/local/bin/vmd_LINUXAMD64 && \
    ln -sf /tools/namd/namd3 /usr/local/bin/namd3 && \
    ln -sf /tools/vmd/bin/vmd.sh /usr/local/bin/vmd

ENV VMDDIR=/tools/vmd
ENV MASTERVMDDIR=/tools/vmd
ENV VMDDISPLAYDEVICE=text
ENV TCL_LIBRARY=/tools/vmd/lib/scripts/tcl8.5
ENV TK_LIBRARY=/tools/vmd/lib/scripts/tcl8.5
ENV PATH="/tools/namd:/tools/vmd/bin:/tools/vmd/LINUXAMD64:${PATH}"

RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=20.3.0

RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION} && nvm use v${NODE_VERSION} && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

WORKDIR /webserver

COPY package.json ./
RUN npm install

COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY tsconfig.json ./tsconfig.json

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]