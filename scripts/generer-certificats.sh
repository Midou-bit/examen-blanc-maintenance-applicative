#!/usr/bin/env bash
# =============================================================================
# Génère une autorité de certification locale et les certificats HTTPS
# (consigne E23 : « installation et vérification des certificats de sécurité »)
# =============================================================================
#
# POURQUOI UNE AUTORITÉ LOCALE ?
#
# En production, on utiliserait Let's Encrypt : gratuit, automatisé, reconnu
# par tous les navigateurs. Mais Let's Encrypt exige un nom de domaine PUBLIC
# qu'il puisse vérifier depuis Internet — impossible avec « app.exam.local ».
#
# On crée donc notre propre autorité de certification. La chaîne de confiance
# est EXACTEMENT la même qu'en production :
#
#     Autorité (CA)  ->  signe  ->  Certificat du serveur  ->  HTTPS
#
# Seule différence : les navigateurs connaissent Let's Encrypt d'avance, pas
# notre autorité. D'où l'avertissement, levé en important le fichier ca.crt.
# =============================================================================

set -euo pipefail

DOSSIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
JOURS=825   # limite acceptée par les navigateurs pour un certificat serveur

mkdir -p "$DOSSIER"
cd "$DOSSIER"

echo "▸ Génération de l'autorité de certification locale…"
openssl genrsa -out ca.key 4096 2>/dev/null
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/C=FR/O=Examen Blanc/CN=Autorite Locale Examen" 2>/dev/null

echo "▸ Génération de la clé du serveur…"
openssl genrsa -out serveur.key 2048 2>/dev/null

echo "▸ Demande de signature…"
openssl req -new -key serveur.key -out serveur.csr \
  -subj "/C=FR/O=Examen Blanc/CN=app.exam.local" 2>/dev/null

# ┌─ LE POINT QUI FAIT ÉCHOUER 90 % DES PREMIÈRES TENTATIVES ────────────────┐
# │ Depuis 2017, les navigateurs IGNORENT le champ « Common Name » et ne     │
# │ regardent QUE l'extension « Subject Alternative Name » (SAN). Un         │
# │ certificat sans SAN est rejeté, même parfaitement valide par ailleurs.   │
# │ Il faut donc y lister TOUS les noms couverts.                            │
# └──────────────────────────────────────────────────────────────────────────┘
cat > extensions.cnf <<'EOF'
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @noms

[noms]
DNS.1 = app.exam.local
DNS.2 = api.exam.local
DNS.3 = grafana.exam.local
DNS.4 = localhost
IP.1  = 127.0.0.1
EOF

echo "▸ Signature du certificat par l'autorité…"
openssl x509 -req -in serveur.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out serveur.crt -days "$JOURS" -sha256 -extfile extensions.cnf 2>/dev/null

rm -f serveur.csr extensions.cnf ca.srl

echo
echo "✓ Certificats générés dans $DOSSIER :"
echo "    ca.crt       autorité — à importer dans le navigateur"
echo "    serveur.crt  certificat du serveur"
echo "    serveur.key  clé privée (JAMAIS versionnée)"
echo
echo "▸ Vérification du certificat :"
openssl x509 -in serveur.crt -noout -subject -issuer -dates -ext subjectAltName
echo
echo "───────────────────────────────────────────────────────────────────"
echo "ÉTAPE SUIVANTE — déclarer les noms de domaine locaux."
echo "Ajoutez à /etc/hosts (Linux) ou"
echo "C:\\Windows\\System32\\drivers\\etc\\hosts (Windows) :"
echo
echo "    127.0.0.1  app.exam.local api.exam.local grafana.exam.local"
echo
echo "Commande toute prête (Linux) :"
echo "    echo '127.0.0.1 app.exam.local api.exam.local grafana.exam.local' | sudo tee -a /etc/hosts"
echo "───────────────────────────────────────────────────────────────────"
