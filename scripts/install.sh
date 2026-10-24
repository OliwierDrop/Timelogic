#!/usr/bin/env bash
# TimeLogic — interaktywny instalator (Linux + Docker).
# curl -fsSL https://raw.githubusercontent.com/OliwierDrop/Timelogic/main/scripts/install.sh | bash
# albo: ./scripts/install.sh

set -euo pipefail

REPO_URL="${TIMELOGIC_REPO:-https://github.com/OliwierDrop/Timelogic.git}"
REPO_BRANCH="${TIMELOGIC_BRANCH:-main}"

# Ustawiane w ask_config / ask_exposure
EXPOSE_MODE=""
COMPOSE_OVERRIDE=""
PUBLIC_ORIGIN=""
COOKIE_SECURE=""
TRUSTED_PROXIES=""
CERT_FULLCHAIN=""
CERT_PRIVKEY=""

die() {
  echo "Błąd: $*" >&2
  exit 1
}

info() {
  echo "→ $*"
}

ensure_tty() {
  if [[ ! -t 0 ]]; then
    if [[ -r /dev/tty ]]; then
      exec </dev/tty
    else
      die "Brak interaktywnego terminala (uruchom bez pipe albo w prawdziwym TTY)."
    fi
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Wymagane polecenie niedostępne: $1"
}

preflight() {
  require_cmd git
  require_cmd docker
  if ! docker compose version >/dev/null 2>&1; then
    die "Wymagany Docker Compose (plugin: docker compose). Zainstaluj Docker Engine + Compose."
  fi
  if ! docker info >/dev/null 2>&1; then
    die "Daemon Dockera nie odpowiada. Uruchom Docker i spróbuj ponownie."
  fi
}

prompt() {
  local label="$1"
  local default="${2:-}"
  local value=""
  if [[ -n "$default" ]]; then
    read -r -p "$label [$default]: " value
    echo "${value:-$default}"
  else
    read -r -p "$label: " value
    echo "$value"
  fi
}

prompt_secret() {
  local label="$1"
  local value=""
  read -r -s -p "$label: " value
  echo >&2
  echo "$value"
}

valid_email() {
  local email="$1"
  [[ "$email" == *@*.* ]] || return 1
  [[ "$email" != *@localhost ]] || return 1
  [[ "$email" != *@localhost.* ]] || return 1
  return 0
}

valid_https_dns() {
  local url="$1"
  [[ "$url" == https://* ]] || return 1
  local host="${url#https://}"
  host="${host%%/*}"
  host="${host%%:*}"
  [[ "$host" == *.* ]] || return 1
  [[ "$host" != *[[:space:]]* ]] || return 1
  return 0
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '\n' | tr '/+' 'Aa'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n' | tr '/+' 'Aa'
  fi
}

resolve_app_dir() {
  local here script_dir candidate
  here="$(pwd)"
  if [[ -f "$here/compose.yaml" ]]; then
    echo "$here"
    return
  fi
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    candidate="$(cd "$script_dir/.." && pwd)"
    if [[ -f "$candidate/compose.yaml" ]]; then
      echo "$candidate"
      return
    fi
  fi
  echo ""
}

clone_or_use() {
  local app_dir
  app_dir="$(resolve_app_dir)"
  if [[ -n "$app_dir" ]]; then
    info "Używam istniejącego repozytorium: $app_dir"
    echo "$app_dir"
    return
  fi

  local here target
  here="$(pwd)"
  target="${TIMELOGIC_DIR:-$here/timelogic}"

  if [[ -d "$target/.git" && -f "$target/compose.yaml" ]]; then
    info "Znaleziono klon w $target"
    echo "$target"
    return
  fi
  if [[ -e "$target" ]]; then
    die "Katalog $target już istnieje i nie wygląda na TimeLogic. Ustaw TIMELOGIC_DIR lub usuń katalog."
  fi

  info "Klonuję $REPO_URL (branch $REPO_BRANCH) → $target"
  git clone --branch "$REPO_BRANCH" --depth 1 "$REPO_URL" "$target"
  echo "$target"
}

ask_admin() {
  echo
  echo "=== TimeLogic — konto administratora ==="
  echo

  ORG_NAME="$(prompt "Nazwa organizacji" "Moja organizacja")"
  [[ -n "$ORG_NAME" ]] || die "Nazwa organizacji jest wymagana"

  FIRST_NAME="$(prompt "Imię administratora" "Administrator")"
  [[ -n "$FIRST_NAME" ]] || die "Imię jest wymagane"

  LAST_NAME="$(prompt "Nazwisko administratora" "System")"
  [[ -n "$LAST_NAME" ]] || die "Nazwisko jest wymagane"

  while true; do
    ADMIN_EMAIL="$(prompt "E-mail administratora")"
    ADMIN_EMAIL="$(echo "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if valid_email "$ADMIN_EMAIL"; then
      break
    fi
    echo "Podaj prawidłowy e-mail (nie używaj @localhost)." >&2
  done

  while true; do
    ADMIN_PASSWORD="$(prompt_secret "Hasło administratora (min. 12 znaków)")"
    if [[ ${#ADMIN_PASSWORD} -lt 12 ]]; then
      echo "Hasło musi mieć co najmniej 12 znaków." >&2
      continue
    fi
    ADMIN_PASSWORD_CONFIRM="$(prompt_secret "Powtórz hasło")"
    if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
      echo "Hasła nie są zgodne." >&2
      continue
    fi
    break
  done

  POSTGRES_PASSWORD="$(generate_password)"
}

ask_exposure() {
  echo
  echo "=== Udostępnianie (produkcja) ==="
  echo "1) HTTP na porcie 8080 (IP / hostname, LAN lub test)"
  echo "2) Za reverse proxy — DNS + HTTPS (zalecane na produkcję)"
  echo "3) HTTPS wbudowany (własne certyfikaty PEM w TimeLogic)"
  echo

  while true; do
    EXPOSE_MODE="$(prompt "Wybierz tryb" "2")"
    case "$EXPOSE_MODE" in
      1|2|3) break ;;
      *) echo "Wpisz 1, 2 lub 3." >&2 ;;
    esac
  done

  TRUSTED_PROXIES=""
  CERT_FULLCHAIN=""
  CERT_PRIVKEY=""

  case "$EXPOSE_MODE" in
    1)
      COMPOSE_OVERRIDE="scripts/compose.publish.yml"
      COOKIE_SECURE=false
      local host_or_ip
      host_or_ip="$(prompt "Adres IP lub hostname (bez http://)" "localhost")"
      host_or_ip="${host_or_ip#http://}"
      host_or_ip="${host_or_ip#https://}"
      host_or_ip="${host_or_ip%%/*}"
      [[ -n "$host_or_ip" ]] || die "Adres jest wymagany"
      if [[ "$host_or_ip" == *:* && "$host_or_ip" != \[*\]* ]]; then
        PUBLIC_ORIGIN="http://${host_or_ip}"
      else
        PUBLIC_ORIGIN="http://${host_or_ip}:8080"
      fi
      ;;
    2)
      COMPOSE_OVERRIDE="scripts/compose.proxy.yml"
      COOKIE_SECURE=true
      while true; do
        PUBLIC_ORIGIN="$(prompt "Publiczny URL HTTPS (DNS)" "https://rcp.example.com")"
        PUBLIC_ORIGIN="${PUBLIC_ORIGIN%/}"
        if valid_https_dns "$PUBLIC_ORIGIN"; then
          break
        fi
        echo "Podaj https://domena.pl (domena z kropką)." >&2
      done
      TRUSTED_PROXIES="$(prompt "Zaufane IP/CIDR proxy (TRUSTED_PROXIES)" "127.0.0.1,172.16.0.0/12")"
      ;;
    3)
      COMPOSE_OVERRIDE="scripts/compose.tls.yml"
      COOKIE_SECURE=true
      while true; do
        PUBLIC_ORIGIN="$(prompt "Publiczny URL HTTPS (DNS)" "https://rcp.example.com")"
        PUBLIC_ORIGIN="${PUBLIC_ORIGIN%/}"
        if valid_https_dns "$PUBLIC_ORIGIN"; then
          break
        fi
        echo "Podaj https://domena.pl (domena z kropką)." >&2
      done
      while true; do
        CERT_FULLCHAIN="$(prompt "Ścieżka do fullchain.pem")"
        CERT_PRIVKEY="$(prompt "Ścieżka do privkey.pem")"
        if [[ -f "$CERT_FULLCHAIN" && -f "$CERT_PRIVKEY" ]]; then
          break
        fi
        echo "Oba pliki PEM muszą istnieć." >&2
      done
      ;;
  esac
}

write_env() {
  local app_dir="$1"
  local env_file="$app_dir/.env"
  if [[ -f "$env_file" ]]; then
    die "Plik .env już istnieje w $app_dir — instalator nie nadpisuje istniejącej instalacji."
  fi

  umask 077
  {
    echo "POSTGRES_DB=timelogic"
    echo "POSTGRES_USER=timelogic"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "PUBLIC_ORIGIN=${PUBLIC_ORIGIN}"
    echo "COOKIE_SECURE=${COOKIE_SECURE}"
    echo "UPLOAD_DIR=/data/uploads"
    if [[ -n "$TRUSTED_PROXIES" ]]; then
      echo "TRUSTED_PROXIES=${TRUSTED_PROXIES}"
    fi
  } >"$env_file"
  info "Zapisano $env_file"
}

prepare_certs() {
  local app_dir="$1"
  [[ "$EXPOSE_MODE" == "3" ]] || return 0
  mkdir -p "$app_dir/certs"
  cp -f "$CERT_FULLCHAIN" "$app_dir/certs/fullchain.pem"
  cp -f "$CERT_PRIVKEY" "$app_dir/certs/privkey.pem"
  chmod 600 "$app_dir/certs/privkey.pem"
  info "Skopiowano certyfikaty do $app_dir/certs/"
}

write_proxy_snippet() {
  local app_dir="$1"
  [[ "$EXPOSE_MODE" == "2" ]] || return 0
  local host="${PUBLIC_ORIGIN#https://}"
  host="${host%%/*}"
  host="${host%%:*}"
  local out="$app_dir/generated-proxy.md"
  cat >"$out" <<EOF
# Reverse proxy dla TimeLogic

PUBLIC_ORIGIN: \`${PUBLIC_ORIGIN}\`
Upstream: \`127.0.0.1:8080\` (compose.proxy.yml)

## Caddy

\`\`\`
${host} {
	reverse_proxy 127.0.0.1:8080
}
\`\`\`

## nginx

Wzór: \`scripts/proxy-examples/nginx.conf.example\` (podmień \`server_name\` na \`${host}\`).

Upewnij się, że proxy ustawia \`Host\`, \`X-Forwarded-Proto\` i \`X-Forwarded-For\`.
EOF
  info "Zapisano wskazówki proxy: $out"
}

compose() {
  local app_dir="$1"
  shift
  (cd "$app_dir" && docker compose -f compose.yaml -f "$COMPOSE_OVERRIDE" "$@")
}

wait_healthy() {
  local app_dir="$1"
  local deadline=$((SECONDS + 180))
  info "Czekam na gotowość API (max 3 min)…"
  while ((SECONDS < deadline)); do
    local status
    status="$(compose "$app_dir" ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1=="api"{print $2; exit}')"
    if [[ "$status" == "healthy" ]]; then
      info "API jest healthy"
      return 0
    fi
    sleep 3
  done
  compose "$app_dir" logs --tail 80 api || true
  die "Timeout — API nie stało się healthy. Sprawdź: docker compose logs api"
}

run_bootstrap() {
  local app_dir="$1"
  info "Tworzę organizację i konto administratora…"
  if ! compose "$app_dir" exec -T \
    -e "BOOTSTRAP_EMAIL=${ADMIN_EMAIL}" \
    -e "BOOTSTRAP_PASSWORD=${ADMIN_PASSWORD}" \
    -e "BOOTSTRAP_ORGANIZATION=${ORG_NAME}" \
    -e "BOOTSTRAP_FIRST_NAME=${FIRST_NAME}" \
    -e "BOOTSTRAP_LAST_NAME=${LAST_NAME}" \
    api python -m app.bootstrap; then
    die "Bootstrap nie powiódł się (organizacja mogła już istnieć). Sprawdź logi API."
  fi
}

main() {
  echo "TimeLogic — instalator"
  preflight
  ensure_tty

  local app_dir
  app_dir="$(clone_or_use)"
  cd "$app_dir"

  ask_admin
  ask_exposure
  write_env "$app_dir"
  prepare_certs "$app_dir"
  write_proxy_snippet "$app_dir"

  info "Buduję i uruchamiam kontenery ($COMPOSE_OVERRIDE)…"
  compose "$app_dir" up --build -d
  wait_healthy "$app_dir"
  run_bootstrap "$app_dir"

  echo
  echo "=== Instalacja zakończona ==="
  echo "Tryb:       ${EXPOSE_MODE} (${COMPOSE_OVERRIDE})"
  echo "Aplikacja:  ${PUBLIC_ORIGIN}"
  echo "E-mail:     ${ADMIN_EMAIL}"
  echo "Hasło:      (to, które podałeś — nie jest zapisane na dysku)"
  echo "Katalog:    ${app_dir}"
  if [[ "$EXPOSE_MODE" == "2" ]]; then
    echo "Proxy:      skonfiguruj edge wg ${app_dir}/generated-proxy.md"
  fi
  echo
  echo "Zarządzanie: cd ${app_dir} && docker compose -f compose.yaml -f ${COMPOSE_OVERRIDE} ps"
}

main "$@"
