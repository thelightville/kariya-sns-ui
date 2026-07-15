FROM node:20-slim AS runner
WORKDIR /app
ARG KARIYA_SOURCE_REVISION
LABEL org.opencontainers.image.revision=$KARIYA_SOURCE_REVISION
LABEL org.opencontainers.image.title="kariya-sns-ui"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY public ./public
COPY .next/standalone ./
COPY .next/static ./.next/static
USER nextjs
EXPOSE 3010
ENV PORT=3010
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "-e", "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
