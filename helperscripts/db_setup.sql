/*Create the RobotRun database*/
/*This should not be run manually.
  Run this through db_setup.js using
  npm run db_setup -- <mysql_host> <current_host> <admin_user>
*/
CREATE DATABASE IF NOT EXISTS RobotRemote;
CREATE DATABASE IF NOT EXISTS sessions;

CREATE USER IF NOT EXISTS 'RobotRemote'@'{host}' IDENTIFIED BY '{password}';

GRANT EXECUTE, SELECT, DELETE, UPDATE ON RobotRemote.* TO 'RobotRemote'@'{host}';
GRANT EXECUTE, SELECT, DELETE, UPDATE ON sessions.* TO 'RobotRemote'@'{host}';

USE RobotRemote;
/*Create user login request table*/
CREATE TABLE IF NOT EXISTS loginrequests (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                          email_token CHAR(32) NOT NULL,
                                          email_validated BIT(1) NOT NULL DEFAULT 0,
                                          comment TEXT NOT NULL,
                                          date_requested DATETIME NOT NULL) ENGINE INNODB;
/*Create user table*/
CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                  email CHAR(191) NOT NULL UNIQUE, 
                                  passhash CHAR(64) NOT NULL,
                                  passsalt CHAR(64) NOT NULL,
                                  approved BIT(1) NOT NULL DEFAULT 0,
                                  admin BIT(1) NOT NULL DEFAULT 0,
                                  loginreq_id INT UNSIGNED NULL,
                                  FOREIGN KEY (loginreq_id) REFERENCES loginrequests(id) ON DELETE CASCADE) ENGINE INNODB;
/*create timeslot request table*/
CREATE TABLE IF NOT EXISTS timeslots (id INT UNSIGNED AUTO_INCREMENT KEY NOT NULL,
                                      user_id INT UNSIGNED NOT NULL, /*ID of the user reserving this timeslot*/
                                      start_time DATETIME NOT NULL, /*Time when the session should start*/
                                      duration INT UNSIGNED NOT NULL DEFAULT 3600, /*time the timeslot lasts, in seconds*/
                                      approved BIT(1) NOT NULL DEFAULT 0, /*Is this timeslot approved?*/
                                      act_num INT UNSIGNED NULL DEFAULT NULL,
                                      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                                      INDEX user_id (user_id)) ENGINE INNODB; 

DROP PROCEDURE IF EXISTS user_request;

/*Procedures*/
CREATE PROCEDURE user_request
(IN email_in CHAR(191), IN passwordhash CHAR(64), IN passwordsalt CHAR(64), IN email_token_in CHAR(32), IN user_comment TEXT)
BEGIN
    /*Make a new request for a login*/
    INSERT INTO loginrequests (email_token, comment, email_validated, date_requested) VALUES (email_token_in, user_comment, 0, NOW());
    /*Make a new unapproved user*/
    INSERT INTO users (email, passhash, passsalt, loginreq_id, approved, admin) 
        VALUES (email_in, passwordhash, passwordsalt, LAST_INSERT_ID(), 0, 0);
END;
