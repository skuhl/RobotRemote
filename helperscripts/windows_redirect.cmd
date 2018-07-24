@if (1==1) @if(1==0) @ELSE
@echo off&SETLOCAL ENABLEEXTENSIONS
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"||(
    cscript //E:JScript //nologo "%~f0"
    @goto :EOF
)
REM Forwarding ports...
@goto :EOF
@end @ELSE
ShA=new ActiveXObject("Shell.Application");
ShA.ShellExecute("cmd.exe","/c \"netsh.exe interface portproxy add v4tov4 listenport=80 listenaddress=127.0.0.1 connectport=3000 connectaddress=127.0.0.1\"","","runas",5);
ShA.ShellExecute("cmd.exe","/c \"netsh.exe interface portproxy add v4tov4 listenport=443 listenaddress=127.0.0.1 connectport=3001 connectaddress=127.0.0.1\"","","runas",5);
@end