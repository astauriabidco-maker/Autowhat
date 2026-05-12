# =========================================================================
# DOCKERFILE OPTIMISÉ POUR DEPLOIEMENT COOLIFY / HETZNER (SOLOPRENEUR)
# =========================================================================

# --- ETAPE 1: Build du Backend (Express + Prisma) ---
FROM node:20-alpine AS backend-builder

WORKDIR /app

# OpenSSL est requis pour Prisma sur Alpine
RUN apk add --no-cache openssl

# Installer toutes les dépendances (build inclus)
COPY package*.json ./
RUN npm ci --include=dev

# Générer le client Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Compiler le code TypeScript
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build


# --- ETAPE 2: Build du Frontend (React / Vite) ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY client/package*.json ./
RUN npm ci --include=dev

COPY client/ ./
# Construire le site statique
RUN VITE_ENABLE_PWA=false npm run build


# --- ETAPE 3: Image Finale (Légère & Sécurisée) ---
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=true

RUN apk add --no-cache openssl curl

# Uniquement les dépendances de production
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le client Prisma fonctionnel
COPY --from=backend-builder /app/prisma ./prisma
RUN npx prisma generate

# Copier le code backend compilé (.js)
COPY --from=backend-builder /app/dist ./dist
# Optionnel: scripts si appelés dynamiquement
COPY --from=backend-builder /app/scripts ./scripts
RUN chmod +x scripts/start-prod.sh

# Copier le dossier frontend compilé (le backend va le servir)
COPY --from=frontend-builder /app/dist ./client/dist

# Créer le répertoire des uploads avec les bons droits
RUN mkdir -p uploads && chown -R node:node uploads
VOLUME ["/app/uploads"]

# Mettre le bon port (doit correspondre à $PORT ou 3005 par défaut dans l'app)
EXPOSE 3000

# Healthcheck natif pour Coolify (vérifie si l'API répond)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Exécution avec le bon utilisateur (sécurité)
USER node

# Démarrer le serveur via le script de startup
CMD ["./scripts/start-prod.sh"]
