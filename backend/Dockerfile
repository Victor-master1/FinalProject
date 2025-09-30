FROM node:18
RUN apt-get update && apt-get install -y \
  libxi-dev \
  libxext-dev \
  libx11-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
