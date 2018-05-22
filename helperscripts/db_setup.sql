/*Create the RobotRun database*/
create database if not exists RobotRemote;
use RobotRemote;
/*Create user table*/
CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                  email CHAR(191) NOT NULL UNIQUE, 
                                  passhash CHAR(64) NOT NULL,
                                  passsalt CHAR(16) NOT NULL,
                                  approved BIT(1) NOT NULL DEFAULT 0,
                                  admin BIT(1) NOT NULL DEFAULT 0,
                                  loginreq_id INT UNSIGNED NULL);
/*Create user login request table*/
CREATE TABLE IF NOT EXISTS loginrequests (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                          email_token CHAR(32) NOT NULL UNIQUE,
                                          email_validated BIT(1) NOT NULL,
                                          comment TEXT NOT NULL);
/*create timeslot request table*/
CREATE TABLE IF NOT EXISTS timeslots (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                      user_id INT UNSIGNED NOT NULL, /*ID of the user reserving this timeslot*/
                                      start_time DATETIME NOT NULL, /*Time when the session should start*/
                                      duration INT UNSIGNED NOT NULL DEFAULT 3600, /*time the timeslot lasts, in seconds*/
                                      approved BIT(1) NOT NULL DEFAULT 0); /*Is this timeslot approved?*/
/*Setup foreign keys*/
ALTER TABLE users ADD CONSTRAINT fk_loginreq_id FOREIGN KEY (loginreq_id) REFERENCES loginrequests(id);
ALTER TABLE timeslots ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id);

/*Setup indices*/
ALTER TABLE users ADD INDEX email (email); /*This one should fail, unique implies an index*/
ALTER TABLE timeslots ADD INDEX user_id (user_id);
