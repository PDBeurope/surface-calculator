FROM ubuntu:22.04

RUN apt-get update -y
RUN apt-get install -y curl xvfb
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs
# Extra packages are needed to build `gl` library on arm64 architecture (not needed on amd64 aka x86_64):
RUN test "$(arch)" = "x86_64" || apt-get install -y python-is-python3 pkg-config build-essential libxi-dev libglew-dev

RUN mkdir -p /surface-calculator
WORKDIR /surface-calculator

COPY package.json ./
RUN npm install

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

RUN npm install -g .

RUN mkdir -p /xvfb
ENV XVFB_DIR="/xvfb"

COPY docker ./docker

ENTRYPOINT ["bash", "/surface-calculator/docker/xvfb-wrapper-entrypoint.sh", "surface-calculator"]
