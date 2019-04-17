# RobotRemote
Project to remotely control a robotic arm.

## Mechanism
There are 3 basic types processes. Each of these process can be on a different machine. The three processes are:
- The Webserver
- The Arm Server
- The Webcam Server 

The Webserver communicates with the Arm Server and the Camera Servers, in order to match a client with a group of an Arm Server with any Camera Servers it may have. All this is done over SSL, so only the certain client may connect. After this is done, websockets are used for streaming camera video to the client from the Webcam Servers, as well as for sending data about what the user is pressing. The Arm Server takes this pressed data, and sends it over modbus TCP to a connected PLC, which actuates some coils in order to press buttons on the robot. Because we are using websockets, if the client disconnects for some reason without properly terminating, say the network cable is unplugged, the Arm Server can and will detect this, and stop actuating any coils, instead of naively waiting for the client to send a message to actuate no coils.
## Setup
 To run this, you will first need [Ubuntu for Windows](https://www.microsoft.com/en-us/store/p/ubuntu/9nblggh4msv6). Before starting, install the windows version of ffmpeg and make sure your that ffmpeg.exe is on your PATH. Then, open Ubuntu for Windows, and follow the instructions below.

1. Install mysql-server, openssl, git, and npm through apt-get. (`sudo apt-get install git mysql-server openssl npm`)
2. Install [nvm (node version manager)](https://github.com/creationix/nvm). Instructions are provided at the given link. 
3. Install node version 10.0.0 through nvm. To do this, execute `nvm install 10.0.0`;
4. Set version 10.0.0 as the default node version. To do this, execute `nvm alias default 10.0.0`
5. Tell nvm to use version 10.0.0. To do this, execute `nvm use 10.0.0`
6. Clone this directory into an easily accesible folder (`git clone https://github.com/skuhl/RobotRemote.git`)
7. Move into the folder(`cd RobotRemote`), and execute `npm install`
8. Startup the MySQL server, if it hasn't been started up already. To do this, you should execute `sudo service mysql start`.
9. Execute `sudo npm run setup-single-machine`. This will ask you a series of questions, which will then be used to automatically setup the machine as an all-in-one server for controlling a robotic arm. If you are unsure of a certain option, please refer below for a more detailed explanation.
10. Install server certificates. If you are setting up for production, this can be done by obtaining a certificate from a trusted certificate authority (You may want to look into something like [certbot](https://certbot.eff.org/)). If you are just locally installing for tests, you may generate your own certificates. To generate these certificates, run the `gen_cert.sh` script in the `helperscripts` folder. Copy the resulting `key.pem` and `cert.pem` files from `helperscripts/cert` to `arm_server/cert`, `node/cert`, and `webcam_stuff/cert`. If you have gotten your certificate from a trusted source, move these to the same folders, making sure they are in the .pem format, with the names `cert.pem` and `key.pem`. Depending on the format you have received, you may wish to convert it using openssl.
11. If this is a local install, install the ca certificate (`helperscipts/cacert/cacert.pem`). This can be done by copying said file to `/usr/share/ca-certificates/extra/robotremote.crt`, then executing `sudo dpkg-reconfigure ca-certificates`.
12. Run the servers using `npm run start`.
13. Connect to whatever hostname you provided through your browser, assuming you already have it pointing to you machine either through DNS or your hosts file.

After these instructions are done, you can press ctrl-c in order to end the server, and in order to restart, simply re-run the command `npm run start`.

In order to re-run the server after a reboot, or after the ubuntu shell closes, you need to open the ubuntu shell, start up the mysql server (`sudo service mysql start`), navigate to the RobotRemote directory (`cd RobotRemote`), then run `npm run start`.

## Options
### Node webserver (node/settings.json)
| Option                      | Purpose                                                                                | Possible Values                                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http_port`                 | Specify port for http                                                                  | An integer between 0 and 65535, should be above 1024, and forwarded to from port 80                                                                                                                                                            |
| `https_port`                | Specify secure port for https                                                          | An integer between 0 and 65535,  should be above 1024, and forwarderd to from port 443                                                                                                                                                         |
| `mysql_host`                | Specify the location of the mysql server                                               | Host name or IP address (localhost if on the same machine as the webserver)                                                                                                                                                                    |
| `mysql_user`                | Specify the username for the database server                                           | A valid mysql username                                                                                                                                                                                                                         |
| `mysql_port`                | Specify port where the mysql server will listen                                        | An integer between 0 and 65535, default 3306                                                                                                                                                                                                   |
| `mysql_pass`                | specify the password for the database server user                                      | The password for the username given in `mysql_user`                                                                                                                                                                                            |
| `mysql_db`                  | Specify the name of the database being used                                            | Database set up with the schema provided in `db_setup.sql`                                                                                                                                                                                     |
| `actuators_servers`         | Specify information about actuator servers that this webserver can connect clients to. | `actuators` is an array containing actuator objects. Each of these objects contain the `ip` and `port` that the actuator socket listens on                                                                                                     |
| `server_cert_file`          | Specify a certificate for this webserver, so that HTTPS may be used                    | This is a string, giving the path to the file containing the certificate. If this is an empty string, then no certificate will be used, and the server will run in insecure HTTP. It is recommended that you use a certificate. (TODO CERTBOT) |
| `server_key_file`           | Specify the key file used with your certificate.                                       | This is a string, giving the path to the file containing the private key for your certificate. If the `cert_file` is specified, then this option must be specified, otherwise the server will not run properly                                 |
| `ca_file`                   | Specify an optional file to use for certificate authorities                            | This option may be a file containing a list of certificate authorities, or it may be an empty string, in which case the system default certificate authorities are used                                                                        |
| `smtp_auth`                 | Method for authentication                                                              | Typically a login                                                                                                                                                                                                                              |
| `smtp_username`             | Specify  what email to send verification emails from                                   | A valid Gmail account that has "Allow less secure apps" turned OFF                                                                                                                                                                             |
| `smtp_password`             | Allows app access to send emails from specified account                                | Password for the email used in `smtp_username`                                                                                                                                                                                                 |
| `smtp_host`                 | Specify the server that will send emails                                               | A string that contains the name or IP address of the computer to use for SMTP transactions. (e.g. smtp.gmail.com for gmail's SMTP server)                                                                                                      |
| `smtp_port`                 | The port on which the SMTP server listens. (e.g. 465 for gmail's SMTP server)          | An integer between 0 and 65535                                                                                                                                                                                                                 |
| `smtp_secure`               | Specify whether or not to smtp secure or not                                           | `true` or `false`. True for the gmail SMTP server.                                                                                                                                                                                             |
| `mailer_email`              | The email that the mail sent by smtp should use.                                       | A valid Gmail account that has "Allow less secure apps" turned OFF                                                                                                                                                                             |
| `domain_name`               | Specify the domain of the site                                                         | Any valid domain that you are hosting                                                                                                                                                                                                          |
| `domain_name_secure`        | Specify the secure domain of the site                                                  | Any valid secure domain that you are hosting                                                                                                                                                                                                   |
| `log_level`                 | The lowest severity log messages to log                                                | Trace, debug, info, warn, error, fatal                                                                                                                                                                                                         |
| `mulitprocess_logging`      | enable/disable congregation of log files using TCP ports for logging                   | `true` or `false`                                                                                                                                                                                                                              |
| `multiprocess_logging_port` | The port on which the logger will listen and send to                                   | An integer between 0 and 65535  should be above 1024                                                                                                                                                                                           |

### Arm Server(arm_server/settings.json)
| Option                       | Purpose                                                                                                                                                                       | Possible Values                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verbose`                    | Allows you to control the amount of output from this server                                                                                                                   | `true` will print more information, while `false` will print only the essentials (server errors)                                                                                                                                                               |
| `socket_port`                | Specify which port this actuator server will take commands from                                                                                                               | This is a small integer. Try to keep this above 1024, as ports below that are reserved for other well-known services. This value must match what you have for this actuator in the webserver configuration.  Any integer between 1024 and 65535 is acceptable. |
| `websocket_port`             | Specify the socket for the python actuator server to communicate with the client.                                                                                             | Any integer between 1024 and 65535 is acceptable.                                                                                                                                                                                                              |
| `websocket_accepted_origins` | A list of sites that the websocket can accept connections from.                                                                                                               | Domain names or IP addresses                                                                                                                                                                                                                                   |
| `disable_modbus`             | Disables modbus communications. This is useful for testing when a PLC is not available.                                                                                       | Should be `false` in production, or `true` for testing if no PLC is connected. The following modbus options are ignored if this is set to `true`                                                                                                               |
| `modbus_host`                | IP address of the modbus host.                                                                                                                                                | A valid IP address                                                                                                                                                                                                                                             |
| `modbus_port`                | Port that your modbus server is running on                                                                                                                                    | An integer between 0 and 65535                                                                                                                                                                                                                                 |
| `modbus_slave_num`           | Slave number of the PLC you want to control.                                                                                                                                  | A small integer, typically 0. This depends on your setup                                                                                                                                                                                                       |
| `modbus_timeout`             | The amount of seconds to wait before giving up on connecting to the PLC                                                                                                       | A positive float value, denoting the number of seconds to wait                                                                                                                                                                                                 |
| `modbus_sleep_inteval`       | The amount of time to wait in between sending messages to the PLC. This is done so that if a disconnection does occur, the PLC may shut itself off in emergency.              | A positive float value, denoting the number of seconds to wait                                                                                                                                                                                                 |
| `cert_file`                  | Specify a certificate for this actuator server, so that secure sockets/websockets may be used                                                                                 | This is a string, giving the path to the file containing the certificate. If this is an empty string, then no certificate will be used, and the server will run in insecure mode. It is recommended that you use a certificate. (TODO CERTBOT)                 |
| `key_file`                   | Specify the key file used with your certificate.                                                                                                                              | This is a string, giving the path to the file containing the private key for your certificate. If the `cert_file` is specified, then this option must be specified, otherwise the server will not run properly                                                 |
| `client_ca_file`             | Specify an optional file to use for certificate authorities                                                                                                                   | This option may be a file containing a list of certificate authorities, or it may be an empty string, in which case the system default certificate authorities are used                                                                                        |
| `debug`                      | Enables various behaviors related to debugging. This option is insecure, as it uses SSL without verifying certificates.                                                       | For production, always use `false`. For testing, you may consider setting this to `true`, which may allow testing SSL based work without a proper certificate                                                                                                  |
| `pin_assignments`            | A mapping of symbolic button names to modbus addresses. These are actually the modbus addresses + 1, since this is how CLICK decided to show the addresses in their software. | A positive integer corresponding to the modbus address of the coil to activate when the mesage is received. If an address maps to 0, the message will be ignored, and no coils will be activated for that message                                              |
| `log_level`                  | The lowest severity log messages to log                                                                                                                                       | Trace, debug, info, warn, error, fatal                                                                                                                                                                                                                         |
| `multiprocess_logging`       | enable/disable congregation of log files using TCP ports for logging. Should match the NodeWebserver settings                                                                 | True or false                                                                                                                                                                                                                                                  |
| `multiprocess_logging_port`  | The port on which the logger will listen and send to                                                                                                                          | An integer between 0 and 65535  should be above 1024                                                                                                                                                                                                           |

### Webcam Server(webcam_stuff/settings.json)
| Option                      | Purpose                                                                                                       | Possible Values                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stream_port`               | Specify the port of the local ffmpeg TCP stream                                                               | This is a small integer. Try to keep this above 1024, as ports below that are reserved for other well-known services. This value must match what you have for this actuator in the webserver configuration.  Any integer between 1024 and 65535 is acceptable. |
| `websock_port`              | Specify the port for the webcam server to broadcast on                                                        | Any integer between 1024 and 65535 is acceptable.                                                                                                                                                                                                              |
| `ssl`                       | Specify whether to use SSL for this websocket or not.                                                         | `true` or `false`                                                                                                                                                                                                                                              |
| `cert`                      | Specify a certificate so that secure sockets/websockets may be used                                           | This is a string, giving the path to the file containing the certificate. If this is an empty string, then no certificate will be used, and the server will run in insecure mode. It is recommended that you use a certificate. (TODO CERTBOT)                 |
| `key`                       | Specify the key file used with your certificate.                                                              | This is a string, giving the path to the file containing the private key for your certificate. If the `cert_file` is specified, then this option must be specified, otherwise the server will not run properly                                                 |
| `client_ca`                 | Specify an optional file to use for certificate authorities                                                   | This option may be a file containing a list of certificate authorities, or it may be an empty string, in which case the system default certificate authorities are used                                                                                        |
| `log_level`                 | The lowest severity log messages to log                                                                       | Trace, debug, info, warn, error, fatal                                                                                                                                                                                                                         |
| `multiprocess_logging`      | enable/disable congregation of log files using TCP ports for logging. Should match the NodeWebserver settings | True or false                                                                                                                                                                                                                                                  |
| `multiprocess_logging_port` | The port on which the logger will listen and send to                                                          | An integer between 0 and 65535  should be above 1024                                                                                                                                                                                                           |
