mkdir client-cert
openssl genrsa -out client-cert/key.pem 2048
openssl req -config openssl-client.cnf -new -sha256 -key client-cert/key.pem -out client-cert/cert.csr
openssl ca -config openssl-ca.cnf -policy signing_policy -extensions signing_req -out client-cert/cert.pem -infiles client-cert/cert.csr