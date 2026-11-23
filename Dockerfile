# ---- compilação do servidor (PocketBase + hooks JS)
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY server/ ./
# -p 1: compila com menos memória (VPS com 2 GB)
RUN CGO_ENABLED=0 go build -p 1 -trimpath -ldflags "-s -w" -o /orcamento-server .

# ---- imagem final
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Europe/Lisbon
WORKDIR /app
COPY --from=build /orcamento-server /app/orcamento-server
COPY pb_migrations /app/pb_migrations
COPY pb_hooks /app/pb_hooks
COPY pb_public /app/pb_public
VOLUME /app/pb_data
EXPOSE 8090
CMD ["/app/orcamento-server", "serve", "--http=0.0.0.0:8090"]
