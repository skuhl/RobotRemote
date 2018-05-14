# RobotRemote
Project to remotely control a robotic arm.

## Mechanism
Currently, the node portion runs the webserver, which the client connects to.

This webpage uses WebSockets to send data back to the node server, which then sends relays this data to the python server.

The python server listens on a socket for a connection, which contains data about what solenoids to actuate. This data is send to a thread, which is constantly communicating with a PLC. This is necessary, because if there is a disconnection between the PLC and the server actuating the solenoids, we want to stop actuating said solenoids, as a sort of safety feature.

## Setup
This setup is meant for Linux. If you would like to run on Windows 10, these instructions are compatable with [Ubuntu for Windows](https://www.microsoft.com/en-us/store/p/ubuntu/9nblggh4msv6).

1. Pull this repository into a directory (`git clone https://github.com/skuhl/RobotRemote`).
2. Install npm and node. On Debian based distributions (including ubuntu and derivatives), this would be `sudo apt-get update && sudo apt-get install nodejs`
3. Install necessary modules for Node. This can be done through npm. CD to the node folder, then execute `npm install`.
4. Run the node portion of the stack. This can be done by running `npm start`.
5. Install python 3.5 or above. On Debian based distrubutions, this would be installed using `sudo apt-get install python3`. This may already be installed on your system.
6. Install pip. Pip can typically be installed through your package manager (`sudo apt-get install pip3`), but make sure you're getting the python3 compatable version (this is the 3 at the end of pip3). Pip can also be installed as explained [here](https://pip.pypa.io/en/stable/installing/).
7. Create a virtual environment. This can be done by first installing virtualenv (`sudo apt-get install virtualenv`). Then, navigate to the root folder of the git repository, and run `virtualenv -p python3 python`. To check to make sure that your virtual environment worked, CD into the python directory, and execute `source bin/activate`. This enters the virtual environment. Now, execute `python --version`, and verify that your python version is 3.5.x or higher.
8. Install the python dependencies. This can be done by first entering the virtual environment for python. CD into the pyhton folder, then execute `source bin/activate`. Always do this before running the server. Then, execute `pip install -r requirements.txt` 
9. Run the python version of the server. You can do this by executing `python server.py`
10. Connect to `localhost:3000` in your web browser. You should now be connected to the node server. Pressing the buttons on this page should send information to the python server.
