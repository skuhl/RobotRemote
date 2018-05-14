#!/bin/bash
mkdir cacert
touch cacert/index.txt
echo '01' > cacert/serial.txt
openssl req -x509 -config openssl-ca.cnf -newkey rsa:4096 -sha256 -nodes -keyout cacert/cakey.pem -out cacert/cacert.pem -outform PEM
