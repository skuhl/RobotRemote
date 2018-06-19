#!/bin/bash
mkdir cert
openssl genrsa -out cert/key.pem 2048
openssl req -config openssl-server.cnf -new -sha256 -key cert/key.pem -out cert/cert.csr
openssl ca -config openssl-ca.cnf -policy signing_policy -extensions signing_req -out cert/cert.pem -infiles cert/cert.csr
