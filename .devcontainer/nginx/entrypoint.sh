#!/bin/sh

set -e

# Configuration
# -----------------------------------------------------------------------------

CERT_DIR="/tmp"
CERT_NAME="devcert"
CRT="${CERT_DIR}/${CERT_NAME}.crt"
KEY="${CERT_DIR}/${CERT_NAME}.key"

# Certificate parameters
CERT_DAYS=3650
CERT_BITS=2048
CERT_SUBJECT="/CN=localhost/O=HUMS/OU=Development"
CERT_SAN="subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
# -----------------------------------------------------------------------------

log_info() {
    echo "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# Ensure OpenSSL is installed
# -----------------------------------------------------------------------------

check_openssl() {
    if ! command -v openssl >/dev/null 2>&1; then
        log_warn "OpenSSL not found, attempting to install..."
        if command -v apk >/dev/null 2>&1; then
            apk add --no-cache openssl
            log_success "OpenSSL installed successfully"
        else
            log_error "Cannot install OpenSSL (apk not available)"
            exit 1
        fi
    else
        log_info "OpenSSL is available"
    fi
}

# Generate self-signed certificate
# -----------------------------------------------------------------------------

generate_certificate() {
    log_info "Generating ephemeral self-signed certificate..."
    log_info "  Subject: ${CERT_SUBJECT}"
    log_info "  SAN: ${CERT_SAN}"
    log_info "  Valid for: ${CERT_DAYS} days"
    log_info "  Location: ${CERT_DIR}"
    
    if openssl req -x509 -nodes -days "${CERT_DAYS}" -newkey "rsa:${CERT_BITS}" \
        -keyout "${KEY}" -out "${CRT}" \
        -subj "${CERT_SUBJECT}" \
        -addext "${CERT_SAN}" 2>/dev/null; then
        
        log_success "Certificate generated successfully"
        return 0
    else
        log_error "Failed to generate certificate"
        return 1
    fi
}

# Main execution
# -----------------------------------------------------------------------------

main() {
    log_info "Starting NGINX SSL certificate setup..."
    
    # Check for OpenSSL
    check_openssl
    
    # Generate new certificates
    if ! generate_certificate; then
        log_error "Certificate generation failed"
        exit 1
    fi
    
    # Verify certificates are readable
    if [ ! -r "${CRT}" ] || [ ! -r "${KEY}" ]; then
        log_error "Certificates are not readable"
        exit 1
    fi
    
    log_info "Certificate locations:"
    log_info "  Certificate: ${CRT}"
    log_info "  Private key: ${KEY}"
    
    # Start NGINX
    log_success "SSL setup complete, starting NGINX..."
    exec nginx -g 'daemon off;'
}

# Run main function
main
